import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';

const AUTH = {
  Authorization: 'Bearer integration-test-token',
  'X-Zynkronyx-Tenant': 'tenant-test',
  'X-Correlation-Id': 'correlation-test',
};

const env = {
  VERSION: 'test',
  INTEGRATION_TOKEN: 'integration-test-token',
  INTEGRATION_TENANT_ID: 'tenant-test',
};

async function call(path: string, init: RequestInit, bindings: Record<string, unknown> = {}) {
  const request = new Request(`https://worker.test${path}`, {
    ...init,
    headers: { ...AUTH, ...(init.headers as Record<string, string> ?? {}) },
  });
  return worker.fetch(request, { ...env, ...bindings } as never);
}

test('official regular calculator does not fall back to a hardcoded pilot endpoint', async () => {
  const response = await call('/api/v1/official-calculator/regime-geral', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'operation-1' }),
  });
  assert.equal(response.status, 503);
  const body = await response.json() as { error: string; requiredConfiguration: string };
  assert.equal(body.error, 'OFFICIAL_REGULAR_CALCULATOR_ENDPOINT_NOT_CONFIGURED');
  assert.equal(body.requiredConfiguration, 'OFFICIAL_REGULAR_CALCULATOR_URL');
});

test('DANFSe proxy rejects JSON bodies and never forwards them upstream', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('unexpected');
  };
  try {
    const response = await call('/api/v1/official-calculator/danfse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ xml: '<NFSe />' }),
    }, { OFFICIAL_DANFSE_ENDPOINT_URL: 'https://danfse.example/api/danfse' });
    assert.equal(response.status, 415);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DANFSe proxy preserves PDF bytes and correlation metadata', async () => {
  const originalFetch = globalThis.fetch;
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  let forwardedUrl = '';
  let forwardedBody = '';
  globalThis.fetch = async (input, init) => {
    forwardedUrl = String(input);
    forwardedBody = await new Response(init?.body).text();
    return new Response(pdf, {
      status: 200,
      headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="danfse.pdf"' },
    });
  };
  try {
    const response = await call('/api/v1/official-calculator/danfse?stc=2&canhoto=false', {
      method: 'POST',
      headers: { 'content-type': 'application/xml' },
      body: '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" />',
    }, { OFFICIAL_DANFSE_ENDPOINT_URL: 'https://danfse.example/api/danfse' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('content-disposition'), 'inline; filename="danfse.pdf"');
    assert.equal(response.headers.get('X-Correlation-Id'), 'correlation-test');
    assert.ok(forwardedUrl.includes('stc=2'));
    assert.ok(forwardedUrl.includes('canhoto=false'));
    assert.equal(forwardedBody, '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" />');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [...pdf]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DANFSe proxy enforces the 5 MiB XML ingress limit', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('unexpected');
  };
  try {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    const response = await call('/api/v1/official-calculator/danfse', {
      method: 'POST',
      headers: { 'content-type': 'application/xml' },
      body: oversized,
    }, { OFFICIAL_DANFSE_ENDPOINT_URL: 'https://danfse.example/api/danfse' });
    assert.equal(response.status, 413);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('NF-e availability endpoint reads official indicators without inventing unknown states', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`
    <div>Última Verificação: 25/11/2026 03:02:22</div>
    <div>WebServices Versão 4.00</div>
    <table><tr><th>Autorizador</th><th>Autorização4</th><th>Retorno4</th><th>Inutilização4</th><th>Consulta</th><th>Status</th><th>Tempo</th><th>Cadastro</th><th>Evento</th></tr>
    <tr><td>SVRS</td><td><img alt="verde" src="green.gif"></td><td><img alt="amarelo" src="yellow.gif"></td><td><img src="unknown.gif"></td><td><img alt="vermelho" src="red.gif"></td><td><img alt="verde" src="green.gif"></td><td>-</td><td><img alt="verde" src="green.gif"></td><td><img alt="verde" src="green.gif"></td></tr>
    <tr><td>SVC-AN</td><td><img alt="verde" src="green.gif"></td></tr></table>`, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  try {
    const response = await call('/api/v1/monitor/nfe', { method: 'GET' });
    assert.equal(response.status, 200);
    const body = await response.json() as {
      ok: boolean;
      snapshot: { santaCatarina: { normalAuthorizer: string; services: Array<{ status: string }> }; parser: { unknownIndicators: number } };
      persistence: { saved: boolean };
    };
    assert.equal(body.ok, true);
    assert.equal(body.snapshot.santaCatarina.normalAuthorizer, 'SVRS');
    assert.equal(body.snapshot.santaCatarina.services[0].status, 'GREEN');
    assert.equal(body.snapshot.santaCatarina.services[1].status, 'YELLOW');
    assert.equal(body.snapshot.parser.unknownIndicators, 2);
    assert.equal(body.persistence.saved, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
