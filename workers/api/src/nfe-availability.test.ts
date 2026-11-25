import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNfeAvailabilityHtml } from './nfe-availability.js';

test('parses explicit status colors and preserves unknown image indicators', () => {
  const html = `
    <div>Última Verificação: 25/11/2026 03:02:22</div>
    <div>WebServices Versão 4.00</div>
    <table><tr><th>Autorizador</th><th>Autorização4</th><th>Retorno4</th><th>Tempo</th></tr>
    <tr><td>SVRS</td><td><img alt="verde" src="green.gif"></td><td><img alt="amarelo" src="yellow.gif"></td><td>-</td></tr>
    <tr><td>SVC-AN</td><td><img src="indicator.gif"></td><td><img alt="vermelho" src="red.gif"></td><td>-</td></tr></table>`;
  const result = parseNfeAvailabilityHtml(html, '2026-11-25T03:05:00.000Z');
  assert.equal(result.authorities.length, 2);
  assert.equal(result.authorities[0].services[0].status, 'GREEN');
  assert.equal(result.authorities[0].services[1].status, 'YELLOW');
  assert.equal(result.authorities[1].services[0].status, 'UNKNOWN');
  assert.equal(result.authorities[1].services[1].status, 'RED');
  assert.equal(result.santaCatarina.normalAuthorizer, 'SVRS');
  assert.equal(result.santaCatarina.contingencyAuthorizer, 'SVC-AN');
  assert.equal(result.sourceLastCheckedAt, '25/11/2026 03:02:22');
  assert.equal(result.version, '4.00');
});

test('does not invent availability when the portal changes its markup', () => {
  const result = parseNfeAvailabilityHtml('<table><tr><td>SVRS</td><td><img src="status1.gif"></td></tr></table>');
  assert.equal(result.authorities[0].services[0].status, 'UNKNOWN');
  assert.equal(result.parser.recognizedIndicators, 0);
  assert.equal(result.parser.unknownIndicators, 1);
});
