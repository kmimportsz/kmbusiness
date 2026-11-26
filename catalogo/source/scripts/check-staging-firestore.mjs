import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import worker from '../worker/index.js';

const project = 'km-business-homologacao';
const account = `nexus-order-writer@${project}.iam.gserviceaccount.com`;
const [file, ...extra] = process.argv.slice(2);
const catalog = {
  products: [{ id: 'teste-homologacao', brand: 'Teste', model: 'Peça sintética', size: 'M', price: 30 }],
  phone: '5500000000000'
};

async function main() {
  if (!file || extra.length) throw Error('Informe somente o caminho do JSON da conta de serviço.');
  if ((await stat(file)).mode & 0o077) throw Error('Restrinja o arquivo com chmod 600 antes do teste.');
  const secret = await readFile(file, 'utf8');
  const key = JSON.parse(secret);
  if (key.type !== 'service_account' || key.project_id !== project || key.client_email !== account
      || typeof key.private_key !== 'string' || !key.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw Error('A chave precisa pertencer à conta de serviço exclusiva de homologação.');
  }

  // This command exercises the Worker locally with OAuth and the hosted test database.
  const originalFetch = globalThis.fetch;
  const ordersPath = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/nexusOrders`;
  globalThis.fetch = (target, init) => {
    const url = new URL(target);
    const endpoint = url.origin + url.pathname;
    const isTestOrder = endpoint === ordersPath || endpoint.startsWith(ordersPath + '/');
    if (url.href !== 'https://oauth2.googleapis.com/token' && !isTestOrder) {
      throw Error('Destino externo fora do teste isolado.');
    }
    return originalFetch(target, { ...init, redirect: 'error' });
  };

  try {
    const id = randomUUID();
    const order = {
      key: id, name: 'Pedido sintético de homologação', mode: 'pickup',
      items: [{ id: catalog.products[0].id, quantity: 1, priceCents: 3000 }]
    };
    const submit = (body, origin = 'https://kmimportsz.github.io', bindings = {}) => worker.fetch(
      new Request('https://preview.example.invalid/api/orders', {
        method: 'POST', headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }), {
        BUCKET: { get: async () => ({ json: async () => catalog }) },
        ORDER_FIRESTORE_PROJECT: project, ORDER_FIRESTORE_WRITER: secret, ...bindings
      });

    assert.equal((await submit(order, 'https://untrusted.example.invalid')).status, 403);
    assert.equal((await submit(order, undefined, { ORDER_FIRESTORE_WRITER: '' })).status, 503);

    const responses = await Promise.all([submit(order), submit(order)]);
    for (const response of responses) {
      assert.equal(response.status, 201, 'O Worker não conseguiu autenticar ou registrar no Firestore de homologação.');
    }
    const [first, duplicate] = await Promise.all(responses.map(response => response.json()));
    assert.deepEqual(duplicate, first);
    assert.equal(first.code, id.replaceAll('-', '').toUpperCase());
    assert.equal(first.subtotalCents, 3000);
    const replay = await submit(order);
    assert.equal(replay.status, 201);
    assert.deepEqual(await replay.json(), first);
    assert.equal((await submit({ ...order, name: 'Tentativa diferente' })).status, 409);

    console.log(JSON.stringify({
      project, orderId: id, status: 'aprovado', oauth: true, sameKeyConcurrent: true,
      replay: true, conflictingPayloadRejected: true, invalidOriginRejected: true
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch(error => {
  console.error(error instanceof SyntaxError ? 'JSON inválido.' : error.message);
  process.exitCode = 1;
});
