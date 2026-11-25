import {
  runAgentHost,
  type AgentHostResult,
  type AgentModelProvider,
} from './agent-host.js';
import { createFiscalAgentToolRunner, type FiscalToolEnvironment } from './fiscal-tool-runner.js';
import { FISCAL_MCP_TOOLS } from './fiscal-tool-catalog.js';
import { prepareSkillRuntime, type PreparedSkillRuntime } from './skill-runtime.js';

export interface RunFiscalAgentRequest {
  query: string;
  tenantId: string;
  requestId: string;
  correlationId: string;
  context?: Record<string, unknown>;
  requestedSkillIds?: string[];
  maxSkills?: number;
  /** Host policy output; never inferred from Skill toolBindings. */
  authorizedTools: string[];
  maxIterations?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
}

export interface RunFiscalAgentResult {
  prepared: PreparedSkillRuntime;
  agent: AgentHostResult | null;
  status: 'NO_MATCH' | 'COMPLETED' | 'NEEDS_HUMAN_REVIEW' | 'FAILED';
}

export function runPreparedFiscalAgent(
  request: RunFiscalAgentRequest,
  env: FiscalToolEnvironment,
  model: AgentModelProvider,
): Promise<RunFiscalAgentResult> | RunFiscalAgentResult {
  const prepared = prepareSkillRuntime({
    query: request.query,
    context: request.context,
    requestedSkillIds: request.requestedSkillIds,
    maxSkills: request.maxSkills,
  }, {
    requestId: request.requestId,
    correlationId: request.correlationId,
  });

  if (prepared.status === 'NO_MATCH') {
    return { prepared, agent: null, status: 'NO_MATCH' };
  }

  // A binding is only a capability ceiling. Also intersect with the concrete
  // MCP-call catalog so unsupported HTTP-only bindings never reach this runner.
  const executableNames = new Set(FISCAL_MCP_TOOLS.map(tool => tool.name));
  const toolBindings = prepared.toolBindings.filter(name => executableNames.has(name));
  const authorizedTools = request.authorizedTools.filter(name => executableNames.has(name));

  return runAgentHost({
    query: prepared.request.query,
    context: prepared.context,
    tenantId: request.tenantId,
    requestId: prepared.request.requestId,
    correlationId: prepared.request.correlationId,
    instructions: prepared.instructions.map(item => ({ id: item.id, content: item.content })),
    toolBindings,
    authorizedTools,
    maxIterations: request.maxIterations,
    maxToolCalls: request.maxToolCalls,
    timeoutMs: request.timeoutMs,
  }, {
    model,
    tools: createFiscalAgentToolRunner(env),
  }).then(agent => ({
    prepared,
    agent,
    status: agent.status,
  }));
}
