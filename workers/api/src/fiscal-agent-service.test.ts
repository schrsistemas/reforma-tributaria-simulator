import test from 'node:test';
import assert from 'node:assert/strict';
import { runPreparedFiscalAgent } from './fiscal-agent-service.js';
import type { AgentModelProvider } from './agent-host.js';

const baseRequest = {
  query: 'Analisar IBS e avaliar crédito tributário',
  tenantId: 'tenant-fiscal-01',
  requestId: 'request-fiscal-01',
  correlationId: 'correlation-fiscal-01',
  authorizedTools: ['fiscal.evaluate_credit_eligibility'],
};

function model(generate: AgentModelProvider['generate']): AgentModelProvider {
  return { generate };
}

test('prepares selected Skills and executes a real deterministic Fiscal Domain tool', async () => {
  const response = await runPreparedFiscalAgent(baseRequest, {}, model(async request => {
    if (request.iteration === 1) {
      return {
        toolCalls: [{
          id: 'eligibility-1',
          name: 'fiscal.evaluate_credit_eligibility',
          input: {
            category: 'GOODS',
            regularTaxpayer: true,
            electronicFiscalDocument: true,
            taxDebtExtinguished: true,
            economicActivityRelated: true,
          },
        }],
      };
    }
    assert.equal(request.history.length, 1);
    return { finalText: 'A elegibilidade foi avaliada pelo motor determinístico; consulte os avisos e a regra aplicável.' };
  }));

  assert.equal(response.prepared.status, 'PREPARED');
  assert.ok(response.prepared.instructions.some(item => item.id === 'ibs-cbs-transicao'));
  assert.equal(response.status, 'COMPLETED');
  assert.equal(response.agent?.toolCalls, 1);
  assert.equal(response.agent?.request.tenantId, 'tenant-fiscal-01');
  assert.equal(response.agent?.request.correlationId, 'correlation-fiscal-01');
});

test('does not execute a tool that is not authorized by the host policy', async () => {
  const response = await runPreparedFiscalAgent({
    ...baseRequest,
    authorizedTools: [],
  }, {}, model(async () => ({
    toolCalls: [{
      id: 'eligibility-denied',
      name: 'fiscal.evaluate_credit_eligibility',
      input: {
        category: 'GOODS',
        regularTaxpayer: true,
        electronicFiscalDocument: true,
        taxDebtExtinguished: true,
      },
    }],
  })));

  assert.equal(response.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(response.agent?.toolCalls, 0);
  assert.ok(response.agent?.warnings.some(warning => warning.startsWith('AGENT_TOOL_NOT_AUTHORIZED:')));
});

test('returns NO_MATCH without invoking the model for unrelated requests', async () => {
  let modelInvoked = false;
  const response = await runPreparedFiscalAgent({
    ...baseRequest,
    query: 'Pergunta sem relação com tributos',
  }, {}, model(async () => {
    modelInvoked = true;
    return { finalText: 'Não deveria executar.' };
  }));

  assert.equal(response.status, 'NO_MATCH');
  assert.equal(response.agent, null);
  assert.equal(modelInvoked, false);
});
