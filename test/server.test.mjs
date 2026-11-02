import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../server.mjs';

test('server serves only the explicit frontend assets and rejects unsafe requests', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const request = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject); req.end();
  });
  const page = await request('/');
  assert.equal(page.status, 200); assert.match(page.body, /RouteLab/);
  assert.match(page.headers['content-security-policy'], /default-src 'self'/);
  assert.equal(page.headers['x-content-type-options'], 'nosniff');
  const module = await request('/src/pathfinding.mjs');
  assert.equal(module.status, 200); assert.match(module.headers['content-type'], /javascript/);
  for (const path of ['/package.json', '/README.md', '/../package.json', '/%2e%2e%2fpackage.json', '/..%5cpackage.json', '/%2fetc/passwd', '/missing']) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/%ZZ')).status, 400);
  assert.equal((await request('/', 'POST')).status, 405);
  const head = await request('/', 'HEAD'); assert.equal(head.status, 200); assert.equal(head.body, '');
});
