import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const address = process.env.FIRESTORE_EMULATOR_HOST;
assert.match(address || '', /^(?:localhost|127\.0\.0\.1):[0-9]{1,5}$/);
const project = 'demo-backup-source-' + randomUUID().slice(0, 8);
const root = `projects/${project}/databases/(default)/documents`;
const fields = {
  number: { integerValue: '9223372036854775807' },
  fraction: { doubleValue: 1.5 },
  nan: { doubleValue: 'NaN' },
  bytes: { bytesValue: 'AP8=' },
  timestamp: { timestampValue: '2026-01-01T00:00:00.123456Z' },
  point: { geoPointValue: { latitude: -23.5, longitude: -46.6 } },
  list: { arrayValue: { values: [{ nullValue: null }, { booleanValue: true }] } },
  nested: { mapValue: { fields: { text: { stringValue: 'Ação' } } } },
  ref: { referenceValue: root + '/estoque/produto-0' }
};
const paths = Array.from({ length: 101 }, (_, i) => 'estoque/produto-' + i);
paths.push('estoque/sem-pai/eventos/evento #1', 'estoque/produto-0/eventos/registrado', 'vendas/sem-campos');
const response = await fetch(`http://${address}/v1/${root}:commit`, {
  method: 'POST',
  headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    writes: paths.map(path => ({ update: { name: root + '/' + path, fields: path === 'vendas/sem-campos' ? {} : fields } }))
  })
});
assert.equal(response.status, 200);
const temp = await mkdtemp(join(tmpdir(), 'km-firestore-test-'));
const file = join(temp, 'backup.json');
const run = async (action, input = file, env = {}) => (await promisify(execFile)(process.execPath,
  [new URL('../scripts/firestore-backup.mjs', import.meta.url).pathname, action, input],
  { env: { ...process.env, FIRESTORE_PROJECT: project, ...env } }
)).stdout;

try {
  const exported = JSON.parse(await run('export'));
  assert.equal(exported.documents, paths.length);
  assert.match(exported.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(await run('verify')), exported);
  const backup = JSON.parse(await readFile(file, 'utf8'));
  const snapshot = JSON.parse(backup.payload);
  assert.deepEqual(snapshot.documents.map(doc => doc.path).sort(), paths.sort());
  const restored = JSON.parse(await run('restore-test'));
  assert.equal(restored.documents, paths.length);
  assert.equal(restored.sha256, exported.sha256);
  assert.equal(restored.restored, true);
  assert.notEqual(restored.target, project);
  await assert.rejects(run('restore-test', file, { FIRESTORE_EMULATOR_HOST: '' }), /emulador local/);
  await assert.rejects(run('export'), /EEXIST/);
  await writeFile(file, JSON.stringify({ ...backup, payload: backup.payload + ' ' }));
  await assert.rejects(run('verify'), /SHA-256 inválido/);
  await assert.rejects(run('restore-test'), /SHA-256 inválido/);
  console.log('PASS: 104 documentos, paginação, subcoleções, tipos nativos, restauração, isolamento e adulteração.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
