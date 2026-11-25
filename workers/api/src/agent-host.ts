/**
 * Provider-neutral execution loop for the fiscal Skills runtime.
 *
 * The host supplies a model adapter and a tool runner. This module enforces
 * the prepared Skill binding allowlist, bounded iterations, sequential tool
 * execution, per-operation deadlines, and an auditable execution trace.
 *
 * It deliberately does not implement a model provider or grant permissions.
 */
export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AgentModelMessage {
  role: 'tool';
  toolCallId: string;
  name: string;
  content: unknown;
  error?: string;
}

export interface AgentModelTurn {
  /** User-facing answer. A turn with toolCalls may omit this field. */
  finalText?: string;
  toolCalls?: AgentToolCall[];
}

export interface AgentModelRequest {
  query: string;
  context: Record<string, unknown>;
  instructions: Array<{ id: string; content: string }>;
  history: AgentModelMessage[];
  iteration: number;
  signal: AbortSignal;
}

export interface AgentModelProvider {
  generate(request: AgentModelRequest): Promise<AgentModelTurn>;
}

export interface AgentToolContext {
  tenantId: string;
  requestId: string;
  correlationId: string;
  signal: AbortSignal;
}

export interface AgentToolRunner {
  execute(
    toolName: string,
    input: Record<string, unknown>,
    context: AgentToolContext,
  ): Promise<unknown>;
}

export interface AgentHostRequest {
  query: string;
  context?: Record<string, unknown>;
  tenantId: string;
  requestId: string;
  correlationId: string;
  instructions: Array<{ id: string; content: string }>;
  /** Skill bindings are a ceiling, never an authorization grant. */
  toolBindings: string[];
  /** Actual host authorization, intersected with Skill bindings. */
  authorizedTools: string[];
  maxIterations?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
}

export interface AgentExecutionEvent {
  sequence: number;
  type: 'MODEL_REQUESTED' | 'TOOL_STARTED' | 'TOOL_SUCCEEDED' | 'TOOL_FAILED' | 'MODEL_COMPLETED';
  iteration: number;
  toolName?: string;
  toolCallId?: string;
  detail?: string;
}

export interface AgentHostResult {
  status: 'COMPLETED' | 'NEEDS_HUMAN_REVIEW' | 'FAILED';
  execution: 'EXECUTED';
  answer: string | null;
  iterations: number;
  toolCalls: number;
  warnings: string[];
  events: AgentExecutionEvent[];
  request: { tenantId: string; requestId: string; correlationId: string };
}

export class AgentHostError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'AgentHostError';
    this.code = code;
  }
}

const DEFAULT_MAX_ITERATIONS = 6;
const DEFAULT_MAX_TOOL_CALLS = 12;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ITERATIONS_LIMIT = 12;
const MAX_TOOL_CALLS_LIMIT = 30;
const MAX_TIMEOUT_MS = 60_000;

function validateRequest(request: AgentHostRequest): Required<Pick<
  AgentHostRequest,
  'maxIterations' | 'maxToolCalls' | 'timeoutMs'
>> {
  if (!request || typeof request.query !== 'string' || !request.query.trim()) {
    throw new AgentHostError('AGENT_QUERY_REQUIRED');
  }
  if (!request.tenantId?.trim() || !request.requestId?.trim() || !request.correlationId?.trim()) {
    throw new AgentHostError('AGENT_CORRELATION_METADATA_REQUIRED');
  }
  if (!Array.isArray(request.instructions) || request.instructions.length === 0 ||
      request.instructions.some(item => !item.id || !item.content?.trim())) {
    throw new AgentHostError('AGENT_INSTRUCTIONS_REQUIRED');
  }
  if (!Array.isArray(request.toolBindings) || !Array.isArray(request.authorizedTools)) {
    throw new AgentHostError('AGENT_TOOL_POLICY_INVALID');
  }

  const maxIterations = request.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxToolCalls = request.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > MAX_ITERATIONS_LIMIT) {
    throw new AgentHostError('AGENT_MAX_ITERATIONS_INVALID');
  }
  if (!Number.isInteger(maxToolCalls) || maxToolCalls < 1 || maxToolCalls > MAX_TOOL_CALLS_LIMIT) {
    throw new AgentHostError('AGENT_MAX_TOOL_CALLS_INVALID');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new AgentHostError('AGENT_TIMEOUT_INVALID');
  }
  return { maxIterations, maxToolCalls, timeoutMs };
}

async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  deadline: number,
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new AgentHostError('AGENT_EXECUTION_TIMEOUT');

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AgentHostError('AGENT_EXECUTION_TIMEOUT'));
    }, remaining);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Runs a bounded model/tool cycle. Tool calls are sequential by design:
 * fiscal workflows retain deterministic ordering and a single audit trail.
 */
export async function runAgentHost(
  request: AgentHostRequest,
  dependencies: { model: AgentModelProvider; tools: AgentToolRunner },
): Promise<AgentHostResult> {
  const limits = validateRequest(request);
  if (!dependencies?.model || typeof dependencies.model.generate !== 'function' ||
      !dependencies?.tools || typeof dependencies.tools.execute !== 'function') {
    throw new AgentHostError('AGENT_DEPENDENCIES_REQUIRED');
  }

  const bindingSet = new Set(request.toolBindings);
  const authorizedSet = new Set(request.authorizedTools);
  const allowedTools = new Set([...bindingSet].filter(name => authorizedSet.has(name)));
  const history: AgentModelMessage[] = [];
  const events: AgentExecutionEvent[] = [];
  const warnings: string[] = [];
  const deadline = Date.now() + limits.timeoutMs;
  let toolCalls = 0;
  let iterations = 0;

  const record = (event: Omit<AgentExecutionEvent, 'sequence'>): void => {
    events.push({ sequence: events.length + 1, ...event });
  };

  const result = (
    status: AgentHostResult['status'],
    answer: string | null,
  ): AgentHostResult => ({
    status,
    execution: 'EXECUTED',
    answer,
    iterations,
    toolCalls,
    warnings: [...new Set(warnings)],
    events,
    request: {
      tenantId: request.tenantId,
      requestId: request.requestId,
      correlationId: request.correlationId,
    },
  });

  for (let iteration = 1; iteration <= limits.maxIterations; iteration += 1) {
    iterations = iteration;
    record({ type: 'MODEL_REQUESTED', iteration });

    let turn: AgentModelTurn;
    try {
      turn = await withDeadline(
        signal => dependencies.model.generate({
          query: request.query,
          context: request.context ?? {},
          instructions: request.instructions,
          history: [...history],
          iteration,
          signal,
        }),
        deadline,
      );
    } catch (error) {
      const code = error instanceof AgentHostError
        ? error.code
        : error instanceof Error ? error.message : 'AGENT_MODEL_FAILED';
      warnings.push(code);
      return result('FAILED', null);
    }

    if (!turn || (turn.finalText !== undefined && typeof turn.finalText !== 'string') ||
        (turn.toolCalls !== undefined && !Array.isArray(turn.toolCalls))) {
      warnings.push('AGENT_MODEL_RESPONSE_INVALID');
      return result('FAILED', null);
    }

    const calls = turn.toolCalls ?? [];
    if (calls.length === 0) {
      const answer = turn.finalText?.trim() ?? '';
      if (!answer) {
        warnings.push('AGENT_EMPTY_FINAL_ANSWER');
        return result('NEEDS_HUMAN_REVIEW', null);
      }
      record({ type: 'MODEL_COMPLETED', iteration });
      return result('COMPLETED', answer);
    }

    if (toolCalls + calls.length > limits.maxToolCalls) {
      warnings.push('AGENT_TOOL_CALL_LIMIT_REACHED');
      return result('NEEDS_HUMAN_REVIEW', turn.finalText?.trim() || null);
    }

    const ids = new Set<string>();
    for (const call of calls) {
      if (!call || typeof call.id !== 'string' || !call.id.trim() || ids.has(call.id) ||
          typeof call.name !== 'string' || !call.name.trim() ||
          !call.input || typeof call.input !== 'object' || Array.isArray(call.input)) {
        warnings.push('AGENT_TOOL_CALL_INVALID');
        return result('NEEDS_HUMAN_REVIEW', null);
      }
      ids.add(call.id);
      if (!allowedTools.has(call.name)) {
        warnings.push(`AGENT_TOOL_NOT_AUTHORIZED:${call.name}`);
        return result('NEEDS_HUMAN_REVIEW', null);
      }
    }

    for (const call of calls) {
      toolCalls += 1;
      record({
        type: 'TOOL_STARTED',
        iteration,
        toolName: call.name,
        toolCallId: call.id,
      });

      try {
        const output = await withDeadline(
          signal => dependencies.tools.execute(call.name, call.input, {
            tenantId: request.tenantId,
            requestId: request.requestId,
            correlationId: request.correlationId,
            signal,
          }),
          deadline,
        );
        history.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: output,
        });
        record({
          type: 'TOOL_SUCCEEDED',
          iteration,
          toolName: call.name,
          toolCallId: call.id,
        });
      } catch (error) {
        const code = error instanceof AgentHostError
          ? error.code
          : error instanceof Error ? error.message : 'AGENT_TOOL_EXECUTION_FAILED';
        warnings.push(`TOOL_FAILED:${call.name}:${code}`);
        history.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: null,
          error: code,
        });
        record({
          type: 'TOOL_FAILED',
          iteration,
          toolName: call.name,
          toolCallId: call.id,
          detail: code,
        });
        if (code === 'AGENT_EXECUTION_TIMEOUT') return result('FAILED', null);
      }
    }
  }

  warnings.push('AGENT_ITERATION_LIMIT_REACHED');
  return result('NEEDS_HUMAN_REVIEW', null);
}
