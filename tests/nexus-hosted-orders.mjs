// Uses one disposable buyer in the staging Firebase project.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

const project = 'km-business-homologacao';
const apiKey = 'AIzaSyAIz9EllW2VorMx0fy-BHMAtEffLgDm5HQ';
const auth = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const documents = `projects/${project}/databases/(default)/documents`;
const firestore = 'https://firestore.googleapis.com/v1/' + documents;
const string = stringValue => ({ stringValue });
const integer = value => ({ integerValue: String(value) });
const timestamp = fieldPath => [{ fieldPath, setToServerValue: 'REQUEST_TIME' }];

function call(url, method, { token, body } = {}) {
  const config = ['url = ' + JSON.stringify(url), 'request = ' + JSON.stringify(method)];
  if (token) config.push('header = ' + JSON.stringify('Authorization: Bearer ' + token));
  if (body) config.push('header = "Content-Type: application/json"', 'data-binary = ' + JSON.stringify(JSON.stringify(body)));
  const output = execFileSync('curl', ['-sS', '--max-time', '15', '--write-out', '\n%{http_code}', '--config', '-'],
    { input: config.join('\n'), encoding: 'utf8' });
  const separator = output.lastIndexOf('\n');
  return { status: Number(output.slice(separator + 1)), data: JSON.parse(output.slice(0, separator)) };
}

function commitOrder(uid, token, key, phone) {
  const id = uid + '_' + key;
  const item = { id: 'homologacao-camiseta', brand: 'Coleção teste', model: 'Camiseta Horizonte', size: 'M', quantity: 1, priceCents: 8000 };
  const fields = {
    key: string(key), code: string(key.replaceAll('-', '').toUpperCase()),
    customer: string('Teste de Homologação'), customerPhone: string(phone), mode: string('pickup'),
    address: { nullValue: null }, notes: string('Pedido sintético para validar aprovação e estoque.'),
    itemsJSON: string(JSON.stringify([item])), subtotalCents: integer(8000), shippingCents: integer(0),
    fingerprint: string(createHash('sha256').update(id).digest('hex')), status: string('pending')
  };
  return call(firestore + ':commit', 'POST', { token, body: { writes: [
    { update: { name: documents + '/nexusOrders/' + id, fields }, updateTransforms: timestamp('createdAt') },
    { update: { name: documents + '/nexusOrderQuota/' + uid, fields: { id: string(id) } }, updateTransforms: timestamp('at') }
  ] } }).status;
}

function main() {
  const report = { project };
  let token;
  try {
    const signup = call(auth + 'signUp?key=' + apiKey, 'POST', { body: { returnSecureToken: true } });
    report.anonymousAuth = signup.status;
    assert.equal(signup.status, 200, 'Login anônimo indisponível.');
    const uid = signup.data.localId;
    token = signup.data.idToken;
    const key = randomUUID();
    const id = uid + '_' + key;
    const read = path => call(firestore + '/' + path, 'GET', { token });
    report.ownMissingOrder = read('nexusOrders/' + id).status;
    report.stockDenied = read('products/homologacao-camiseta').status;
    report.foreignOrderDenied = read('nexusOrders/OutroComprador_' + randomUUID()).status;
    assert.equal(report.ownMissingOrder, 404, 'Consulta no espaço do próprio comprador falhou.');
    assert.equal(report.stockDenied, 403, 'O estoque deve ser privado.');
    assert.equal(report.foreignOrderDenied, 403, 'Pedidos de terceiros devem ser privados.');
    report.invalidPhone = commitOrder(uid, token, key, '');
    assert.equal(report.invalidPhone, 403, 'Pedido sem WhatsApp deve ser recusado.');
    report.validOrder = commitOrder(uid, token, key, '5511999991234');
    assert.equal(report.validOrder, 200, 'Lote de pedido válido recusado.');
    report.orderId = id;
    const saved = read('nexusOrders/' + id);
    assert.equal(saved.status, 200);
    assert.equal(saved.data.fields.status.stringValue, 'pending');
    assert.equal(saved.data.fields.customerPhone.stringValue, '5511999991234');
    report.duplicateDenied = commitOrder(uid, token, key, '5511999991234');
    report.cadenceDenied = commitOrder(uid, token, randomUUID(), '5511999991234');
    assert.equal(report.duplicateDenied, 403);
    assert.equal(report.cadenceDenied, 403);
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error.message;
    process.exitCode = 1;
  } finally {
    if (token) {
      try {
        report.disposableAuthCleanup = call(auth + 'delete?key=' + apiKey, 'POST', { body: { idToken: token } }).status;
      } catch {
        report.disposableAuthCleanup = 'request failed';
      }
      if (report.disposableAuthCleanup !== 200) {
        report.passed = false;
        process.exitCode = 1;
      }
    }
    console.log(JSON.stringify(report, null, 2));
  }
}

main();
