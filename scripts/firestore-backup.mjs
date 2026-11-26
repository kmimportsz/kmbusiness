import { createHash, randomUUID } from 'node:crypto';
import { link, readFile, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const production = 'https://firestore.googleapis.com';
const project = process.env.FIRESTORE_PROJECT || 'agenda-vendas-9922a';
const database = process.env.FIRESTORE_DATABASE || '(default)';
const digest = data => createHash('sha256').update(data).digest('hex');
const encodePath = path => path.split('/').map(encodeURIComponent).join('/');
const serialize = value => JSON.stringify(value, (_, entry) => Object.is(entry, -0) ? '-0' : entry);
const ordered = documents => documents.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function emulatorOrigin() {
  const address = process.env.FIRESTORE_EMULATOR_HOST;
  if (!/^(?:localhost|127\.0\.0\.1):[0-9]{1,5}$/.test(address || '')) {
    throw Error('FIRESTORE_EMULATOR_HOST deve apontar para um emulador local.');
  }
  return 'http://' + address;
}

function firestore(origin, projectId, databaseId, token) {
  const root = `projects/${projectId}/databases/${databaseId}/documents`;
  async function request(path, { body, query, retry = true } = {}) {
    const url = new URL('/v1/' + encodePath(root) + path, origin);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    if (token) headers.Authorization = 'Bearer ' + token;
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        method: body ? 'POST' : 'GET', headers, body: body && serialize(body),
        redirect: 'error', signal: AbortSignal.timeout(30000)
      });
      if (response.ok) return response.json();
      await response.body?.cancel();
      if (!retry || attempt === 3 || ![429, 500, 502, 503, 504].includes(response.status)) {
        throw Error(`Firestore HTTP ${response.status} (${body ? 'POST' : 'GET'}).`);
      }
      await delay(500 * 2 ** attempt);
    }
  }
  async function serverReadTime() {
    const marker = await request(':batchGet', { body: { documents: [root + '/_backup_clock/' + randomUUID()] } });
    const readTime = marker[0]?.readTime;
    if (!readTime) throw Error('A API não retornou o horário da leitura.');
    return readTime;
  }
  async function preflight() {
    const readTime = await serverReadTime();
    await request(':listCollectionIds', { body: { pageSize: 1, readTime } });
    return readTime;
  }
  async function snapshot() {
    const readTime = await serverReadTime();
    // The emulator does not implement the historical read selector on ListDocuments.
    const consistencyTime = origin === production ? readTime : undefined;
    const documents = [];
    async function scan(parent) {
      let collectionPage;
      do {
        const collections = await request(parent + ':listCollectionIds', {
          body: { pageSize: 100, pageToken: collectionPage, readTime: consistencyTime }
        });
        for (const collection of collections.collectionIds || []) {
          let documentPage;
          do {
            const page = await request(parent + '/' + encodeURIComponent(collection), {
              query: { pageSize: 100, pageToken: documentPage, showMissing: true, readTime: consistencyTime }
            });
            for (const doc of page.documents || []) {
              if (!doc.name.startsWith(root + '/')) throw Error('Caminho de documento inesperado.');
              const path = doc.name.slice(root.length + 1);
              const { createTime, updateTime } = doc;
              if (createTime && updateTime) documents.push({ path, fields: doc.fields || {}, createTime, updateTime });
              else if (createTime || updateTime || doc.fields) throw Error('Metadados incompletos em um documento.');
              await scan('/' + encodePath(path));
            }
            documentPage = page.nextPageToken;
          } while (documentPage);
        }
        collectionPage = collections.nextPageToken;
      } while (collectionPage);
    }
    await scan('');
    return { version: 1, project: projectId, database: databaseId, readTime, documents: ordered(documents) };
  }
  async function restore(documents) {
    // Create-only preconditions also guard against concurrent writes into the test project.
    let writes = [];
    let bytes = 0;
    for (const { path, fields } of documents) {
      const write = {
        update: { name: root + '/' + path, fields },
        currentDocument: { exists: false }
      };
      const size = Buffer.byteLength(serialize(write)) + 1;
      if (writes.length && (writes.length === 100 || bytes + size > 5 * 1024 * 1024)) {
        await request(':commit', { body: { writes }, retry: false });
        writes = [];
        bytes = 0;
      }
      writes.push(write);
      bytes += size;
    }
    if (writes.length) await request(':commit', { body: { writes }, retry: false });
  }
  return { preflight, snapshot, restore };
}

async function save(file, snapshot) {
  const payload = serialize(snapshot);
  const sha256 = digest(payload);
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, serialize({ sha256, payload }) + '\n', { mode: 0o600, flag: 'wx' });
    await link(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
  return sha256;
}

async function verify(file) {
  const { sha256, payload } = JSON.parse(await readFile(file, 'utf8'));
  if (typeof payload !== 'string' || sha256 !== digest(payload)) throw Error('SHA-256 inválido.');
  const snapshot = JSON.parse(payload);
  const seen = new Set();
  if (snapshot.version !== 1 || !Array.isArray(snapshot.documents) || !snapshot.readTime) {
    throw Error('Formato de backup inválido.');
  }
  for (const { path, fields, createTime, updateTime } of snapshot.documents) {
    const segments = typeof path === 'string' ? path.split('/') : [];
    if (!segments.length || segments.length % 2 || segments.some(part => !part || part === '.' || part === '..')
        || !fields || typeof fields !== 'object' || Array.isArray(fields) || !createTime || !updateTime || seen.has(path)) {
      throw Error('Documento inválido ou duplicado no backup.');
    }
    seen.add(path);
  }
  return { snapshot, sha256 };
}

async function main() {
  const [action, file, ...extra] = process.argv.slice(2);
  if (action === 'preflight' && !file) {
    const token = process.env.FIRESTORE_ACCESS_TOKEN;
    if (!token || process.env.FIRESTORE_EMULATOR_HOST) throw Error('Preflight exige OAuth e a API de produção.');
    const readTime = await firestore(production, project, database, token).preflight();
    console.log(serialize({ project, database, readTime, permissions: ['datastore.entities.get', 'datastore.entities.list'] }));
    return;
  }
  if (!file || extra.length || !['export', 'verify', 'restore-test'].includes(action)) {
    throw Error('Uso: node scripts/firestore-backup.mjs preflight | export|verify|restore-test <arquivo>');
  }
  if (action === 'export') {
    const local = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
    const token = local ? 'owner' : process.env.FIRESTORE_ACCESS_TOKEN;
    if (!token) throw Error('Forneça um token OAuth autorizado em FIRESTORE_ACCESS_TOKEN.');
    if (local && !project.startsWith('demo-')) throw Error('Use um projeto demo-* para exportação local.');
    const snapshot = await firestore(local ? emulatorOrigin() : production, project, database, token).snapshot();
    console.log(serialize({ documents: snapshot.documents.length, readTime: snapshot.readTime, sha256: await save(file, snapshot) }));
    return;
  }
  const { snapshot, sha256 } = await verify(file);
  if (action === 'restore-test') {
    const target = 'demo-backup-' + randomUUID().slice(0, 12);
    const db = firestore(emulatorOrigin(), target, '(default)', 'owner');
    if ((await db.snapshot()).documents.length) throw Error('O destino da restauração contém dados.');
    await db.restore(snapshot.documents);
    const restored = await db.snapshot();
    const content = docs => serialize(canonical(ordered(docs).map(({ path, fields }) => ({ path, fields }))));
    if (content(restored.documents) !== content(snapshot.documents)) throw Error('A restauração diverge do backup.');
    console.log(serialize({ target, documents: restored.documents.length, sha256, restored: true }));
    return;
  }
  console.log(serialize({ documents: snapshot.documents.length, readTime: snapshot.readTime, sha256 }));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
