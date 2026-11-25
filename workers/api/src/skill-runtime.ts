import instructionsJson from '../../../skills/instructions.json' with { type: 'json' };
import {
  resolveSkillPlan,
  SKILL_REGISTRY,
  SkillDispatchError,
  type ResolveSkillRequest,
  type SkillRegistry,
} from './skill-dispatcher.js';

export interface SkillInstruction {
  path: string;
  blobSha: string;
  content: string;
}

export interface SkillInstructionBundle {
  schemaVersion: string;
  modules: Record<string, SkillInstruction>;
}

export interface PrepareSkillRequest extends ResolveSkillRequest {
  context?: Record<string, unknown>;
}

export interface PreparedSkillRuntime {
  protocolVersion: '1.0.0';
  status: 'PREPARED' | 'NO_MATCH';
  registryVersion: string;
  request: {
    query: string;
    requestId: string;
    correlationId: string;
  };
  plan: ReturnType<typeof resolveSkillPlan>;
  context: Record<string, unknown>;
  instructions: Array<{
    id: string;
    path: string;
    blobSha: string;
    loadedAs: 'ORCHESTRATOR' | 'DEPENDENCY' | 'MATCH';
    content: string;
  }>;
  toolBindings: string[];
  toolAvailability: 'CHECK_MCP_TOOL_CATALOG';
  execution: 'NOT_EXECUTED';
  nextStep: 'HOST_AGENT_EXECUTION_REQUIRED';
}

export class SkillRuntimeError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'SkillRuntimeError';
    this.code = code;
  }
}

export const SKILL_INSTRUCTIONS = instructionsJson as SkillInstructionBundle;
const MAX_CONTEXT_BYTES = 64 * 1024;
const MAX_QUERY_LENGTH = 4_000;

function validateContext(context: unknown): Record<string, unknown> {
  if (context === undefined) return {};
  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    throw new SkillRuntimeError('SKILL_CONTEXT_MUST_BE_OBJECT');
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(context);
  } catch {
    throw new SkillRuntimeError('SKILL_CONTEXT_NOT_SERIALIZABLE');
  }

  if (new TextEncoder().encode(serialized).byteLength > MAX_CONTEXT_BYTES) {
    throw new SkillRuntimeError('SKILL_CONTEXT_TOO_LARGE');
  }

  return context as Record<string, unknown>;
}

/**
 * Loads the exact Markdown instructions selected by the dispatcher and
 * prepares a portable package for an external agent host. It never invokes
 * an LLM or fiscal tool and never claims that the tax task was executed.
 */
export function prepareSkillRuntime(
  request: PrepareSkillRequest,
  metadata: { requestId: string; correlationId: string },
  registry: SkillRegistry = SKILL_REGISTRY,
  bundle: SkillInstructionBundle = SKILL_INSTRUCTIONS,
): PreparedSkillRuntime {
  if (!request || typeof request.query !== 'string' || request.query.trim().length === 0) {
    throw new SkillRuntimeError('SKILL_QUERY_REQUIRED');
  }
  if (request.query.length > MAX_QUERY_LENGTH) {
    throw new SkillRuntimeError('SKILL_QUERY_TOO_LONG');
  }
  if (!metadata.requestId || !metadata.correlationId) {
    throw new SkillRuntimeError('SKILL_RUNTIME_CORRELATION_REQUIRED');
  }

  const context = validateContext(request.context);
  const plan = resolveSkillPlan({
    query: request.query,
    requestedSkillIds: request.requestedSkillIds,
    maxSkills: request.maxSkills,
  }, registry);

  const instructions = plan.orderedSkills.map(skill => {
    const instruction = bundle.modules[skill.id];
    if (!instruction || !instruction.content.trim() || !instruction.path || !instruction.blobSha) {
      throw new SkillRuntimeError(`SKILL_INSTRUCTION_NOT_BUNDLED:${skill.id}`);
    }
    if (instruction.path !== skill.path) {
      throw new SkillRuntimeError(`SKILL_INSTRUCTION_PATH_MISMATCH:${skill.id}`);
    }

    return {
      id: skill.id,
      path: instruction.path,
      blobSha: instruction.blobSha,
      loadedAs: skill.loadedAs,
      content: instruction.content,
    };
  });

  const toolBindings = [...new Set(
    plan.orderedSkills.flatMap(skill => skill.toolBindings),
  )].sort();

  return {
    protocolVersion: '1.0.0',
    status: plan.status === 'READY' ? 'PREPARED' : 'NO_MATCH',
    registryVersion: plan.registryVersion,
    request: {
      query: request.query.trim(),
      requestId: metadata.requestId,
      correlationId: metadata.correlationId,
    },
    plan,
    context,
    instructions,
    toolBindings,
    toolAvailability: 'CHECK_MCP_TOOL_CATALOG',
    execution: 'NOT_EXECUTED',
    nextStep: 'HOST_AGENT_EXECUTION_REQUIRED',
  };
}

export { SkillDispatchError };
