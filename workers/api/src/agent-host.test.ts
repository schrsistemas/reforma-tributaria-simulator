import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentHostError,
  runAgentHost,
  type AgentModelProvider,
  type AgentToolRunner,
} from './agent-host.js';

const baseRequest = {
  query: 'Analise a incidência de IBS e CBS',
  context: { asOf: '2027-01-01' },
  tenantId: 'tenant-test',
  requestId: 'request-agent-001',
  correlationId: 'correlation-agent-001',
  instructions: [{ id: 'ibs-cbs-transicao', content: 'Use evidência oficial e cálculo determinístico.' }],
  toolBindings: ['fiscal.search_evidence', 'fiscal.resolve_ruleset'],
  authorizedTools: ['fiscal.search_evidence', 'fiscal.resolve_ruleset', 'fiscal.admin'],
};

function model(generate: AgentModelProvider['generate']): AgentModelProvider {
  return { generate };
}

function tools(execute: AgentToolRunner['execute']): AgentToolRunner {
  return { execute };
}

test('executes authorized tool calls and returns final model answer with audit trail', async () => {
  const invoked: string[] = [];
  let modelCalls = 0;
  const result = await runAgentHost(baseRequest, {
    model: model(async request => {
      modelCalls += 1;
      if (request.iteration === 1) {
        return {
          toolCalls: [{
            id: 'call-1',
            name: 'fiscal.search_evidence',
            input: { query: 'Lei Complementar IBS CBS' },
          }],
        };
      }
      assert.equal(request.history.length, 1);
      assert.equal(request.history[0].role, 'tool');
      return { finalText: 'A análise depende da vigência e da evidência recuperada.' };
    }),
    tools: tools(async (name, input, context) => {
      invoked.push(name);
      assert.equal(context.tenantId, 'tenant-test');
      assert.equal(context.requestId, 'request-agent-001');
      assert.deepEqual(input, { query: 'Lei Complementar IBS CBS' });
      return { documents: [{ id: 'doc-1', effectiveDate: '2027-01-01' }] };
    }),
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.execution, 'EXECUTED');
  assert.equal(result.answer, 'A análise depende da vigência e da evidência recuperada.');
  assert.equal(result.iterations, 2);
  assert.equal(result.toolCalls, 1);
  assert.deepEqual(invoked, ['fiscal.search_evidence']);
  assert.deepEqual(result.events.map(event => event.type), [
    'MODEL_REQUESTED', 'TOOL_STARTED', 'TOOL_SUCCEEDED', 'MODEL_REQUESTED', 'MODEL_COMPLETED',
  ]);
  assert.deepEqual(result.events.map(event => event.sequence), [1, 2, 3, 4, 5]);
});

test('intersects Skill bindings with host authorization and blocks unbound tools', async () => {
  let executed = false;
  const result = await runAgentHost(baseRequest, {
    model: model(async () => ({
      toolCalls: [{ id: 'call-admin', name: 'fiscal.admin', input: {} }],
    })),
    tools: tools(async () => {
      executed = true;
      return {};
    }),
  });

  assert.equal(result.status, 'NEEDS_HUMAN_REVIEW');
  assert.ok(result.warnings.includes('AGENT_TOOL_NOT_AUTHORIZED:fiscal.admin'));
  assert.equal(executed, false);
  assert.equal(result.toolCalls, 0);
});

test('blocks tools bound by a Skill but not authorized by the host', async () => {
  let executed = false;
  const result = await runAgentHost({
    ...baseRequest,
    authorizedTools: ['fiscal.resolve_ruleset'],
  }, {
    model: model(async () => ({
      toolCalls: [{ id: 'call-search', name: 'fiscal.search_evidence', input: { query: 'IBS' } }],
    })),
    tools: tools(async () => {
      executed = true;
      return {};
    }),
  });

  assert.equal(result.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(executed, false);
  assert.ok(result.warnings[0].startsWith('AGENT_TOOL_NOT_AUTHORIZED:'));
});

test('executes multiple authorized calls sequentially', async () => {
  const order: string[] = [];
  const result = await runAgentHost(baseRequest, {
    model: model(async request => request.iteration === 1
      ? { toolCalls: [
          { id: 'a', name: 'fiscal.search_evidence', input: { query: 'IBS' } },
          { id: 'b', name: 'fiscal.resolve_ruleset', input: { asOf: '2027-01-01' } },
        ] }
      : { finalText: 'Fontes e RuleSet consultados.' }),
    tools: tools(async name => {
      order.push(name);
      return { ok: true };
    }),
  });

  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(order, ['fiscal.search_evidence', 'fiscal.resolve_ruleset']);
  assert.equal(result.toolCalls, 2);
});

test('returns tool failures to the model without hiding the failure', async () => {
  const result = await runAgentHost(baseRequest, {
    model: model(async request => request.iteration === 1
      ? { toolCalls: [{ id: 'missing-doc', name: 'fiscal.search_evidence', input: { query: 'lei' } }] }
      : { finalText: 'A fonte não pôde ser consultada; revisão necessária.' }),
    tools: tools(async () => { throw new Error('RAG_UNAVAILABLE'); }),
  });

  assert.equal(result.status, 'COMPLETED');
  assert.ok(result.warnings.includes('TOOL_FAILED:fiscal.search_evidence:RAG_UNAVAILABLE'));
  assert.equal(result.events.find(event => event.type === 'TOOL_FAILED')?.detail, 'RAG_UNAVAILABLE');
});

test('enforces iteration limit and returns human review state', async () => {
  const result = await runAgentHost({ ...baseRequest, maxIterations: 2 }, {
    model: model(async request => ({
      toolCalls: [{
        id: `call-${request.iteration}`,
        name: 'fiscal.search_evidence',
        input: { query: 'IBS' },
      }],
    })),
    tools: tools(async () => ({ documents: [] })),
  });

  assert.equal(result.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(result.iterations, 2);
  assert.ok(result.warnings.includes('AGENT_ITERATION_LIMIT_REACHED'));
});

test('enforces total tool call limit before executing an oversized batch', async () => {
  let executed = 0;
  const result = await runAgentHost({ ...baseRequest, maxToolCalls: 1 }, {
    model: model(async () => ({
      toolCalls: [
        { id: 'one', name: 'fiscal.search_evidence', input: {} },
        { id: 'two', name: 'fiscal.resolve_ruleset', input: {} },
      ],
    })),
    tools: tools(async () => {
      executed += 1;
      return {};
    }),
  });

  assert.equal(result.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(result.toolCalls, 0);
  assert.equal(executed, 0);
  assert.ok(result.warnings.includes('AGENT_TOOL_CALL_LIMIT_REACHED'));
});

test('rejects duplicate or malformed tool call identifiers', async () => {
  const result = await runAgentHost(baseRequest, {
    model: model(async () => ({
      toolCalls: [
        { id: 'duplicate', name: 'fiscal.search_evidence', input: {} },
        { id: 'duplicate', name: 'fiscal.resolve_ruleset', input: {} },
      ],
    })),
    tools: tools(async () => ({})),
  });

  assert.equal(result.status, 'NEEDS_HUMAN_REVIEW');
  assert.ok(result.warnings.includes('AGENT_TOOL_CALL_INVALID'));
  assert.equal(result.toolCalls, 0);
});

test('enforces overall execution timeout', async () => {
  const result = await runAgentHost({ ...baseRequest, timeoutMs: 100 }, {
    model: model(() => new Promise(() => undefined)),
    tools: tools(async () => ({})),
  });

  assert.equal(result.status, 'FAILED');
  assert.ok(result.warnings.includes('AGENT_EXECUTION_TIMEOUT'));
  assert.equal(result.iterations, 1);
});

test('returns a safe review state for an empty final answer', async () => {
  const result = await runAgentHost(baseRequest, {
    model: model(async () => ({ finalText: '   ' })),
    tools: tools(async () => ({})),
  });

  assert.equal(result.status, 'NEEDS_HUMAN_REVIEW');
  assert.ok(result.warnings.includes('AGENT_EMPTY_FINAL_ANSWER'));
});

test('rejects invalid limits and missing execution metadata', async () => {
  await assert.rejects(
    runAgentHost({ ...baseRequest, maxIterations: 0 }, {
      model: model(async () => ({ finalText: 'x' })),
      tools: tools(async () => ({})),
    }),
    (error: unknown) => error instanceof AgentHostError && error.code === 'AGENT_MAX_ITERATIONS_INVALID',
  );

  await assert.rejects(
    runAgentHost({ ...baseRequest, tenantId: '' }, {
      model: model(async () => ({ finalText: 'x' })),
      tools: tools(async () => ({})),
    }),
    (error: unknown) => error instanceof AgentHostError && error.code === 'AGENT_CORRELATION_METADATA_REQUIRED',
  );
});
