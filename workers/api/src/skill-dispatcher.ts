import registryJson from '../../../skills/registry.json' with { type: 'json' };

export type SkillRole = 'orchestrator' | 'domain' | 'capability';

export interface SkillDefinition {
  id: string;
  path: string;
  role: SkillRole;
  triggers: string[];
  dependsOn?: string[];
  modules?: string[];
}

export interface SkillRegistry {
  schemaVersion: string;
  orchestrator: string;
  skills: SkillDefinition[];
}

export interface ResolveSkillRequest {
  query: string;
  requestedSkillIds?: string[];
  maxSkills?: number;
}

export interface SkillMatch {
  id: string;
  score: number;
  matchedTriggers: string[];
  explicitlyRequested: boolean;
}

export interface SkillPlan {
  status: 'READY' | 'NO_MATCH';
  registryVersion: string;
  query: string;
  orchestrator: string;
  matchedSkills: SkillMatch[];
  orderedSkills: Array<{
    id: string;
    path: string;
    role: SkillRole;
    loadedAs: 'ORCHESTRATOR' | 'DEPENDENCY' | 'MATCH';
  }>;
  unresolved: string[];
  instructionLoading: 'HOST_RUNTIME_REQUIRED';
  execution: 'NOT_EXECUTED';
}

export class SkillDispatchError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'SkillDispatchError';
    this.code = code;
  }
}

export const SKILL_REGISTRY = registryJson as SkillRegistry;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function phraseMatches(query: string, trigger: string): boolean {
  const normalizedTrigger = normalize(trigger);
  if (!normalizedTrigger) return false;
  return ` ${query} `.includes(` ${normalizedTrigger} `);
}

function validateRegistry(registry: SkillRegistry): Map<string, SkillDefinition> {
  if (!registry || !Array.isArray(registry.skills) || !registry.orchestrator) {
    throw new SkillDispatchError('SKILL_REGISTRY_INVALID');
  }

  const byId = new Map<string, SkillDefinition>();
  for (const skill of registry.skills) {
    if (!skill.id || !skill.path || !Array.isArray(skill.triggers) || byId.has(skill.id)) {
      throw new SkillDispatchError('SKILL_REGISTRY_INVALID');
    }
    byId.set(skill.id, skill);
  }

  if (!byId.has(registry.orchestrator)) {
    throw new SkillDispatchError('SKILL_ORCHESTRATOR_NOT_FOUND');
  }

  for (const skill of registry.skills) {
    for (const dependency of skill.dependsOn ?? []) {
      if (!byId.has(dependency)) {
        throw new SkillDispatchError(`SKILL_DEPENDENCY_NOT_FOUND:${skill.id}:${dependency}`);
      }
    }
  }

  return byId;
}

/**
 * Resolves a deterministic, auditable skill plan from the versioned registry.
 * It selects modules and dependencies only; it does not execute an LLM, MCP
 * tool, fiscal calculation, or load SKILL.md instruction bodies.
 */
export function resolveSkillPlan(
  request: ResolveSkillRequest,
  registry: SkillRegistry = SKILL_REGISTRY,
): SkillPlan {
  if (!request || typeof request.query !== 'string' || request.query.trim().length === 0) {
    throw new SkillDispatchError('SKILL_QUERY_REQUIRED');
  }

  const byId = validateRegistry(registry);
  const query = normalize(request.query);
  const requestedIds = [...new Set((request.requestedSkillIds ?? []).map(id => String(id).trim()).filter(Boolean))];

  for (const id of requestedIds) {
    if (!byId.has(id) || id === registry.orchestrator) {
      throw new SkillDispatchError(`SKILL_ID_UNKNOWN:${id}`);
    }
  }

  const maxSkills = request.maxSkills ?? 12;
  if (!Number.isInteger(maxSkills) || maxSkills < 1 || maxSkills > 20) {
    throw new SkillDispatchError('SKILL_MAXIMUM_INVALID');
  }

  const matches: SkillMatch[] = registry.skills
    .filter(skill => skill.role !== 'orchestrator')
    .map(skill => {
      const matchedTriggers = skill.triggers.filter(trigger => phraseMatches(query, trigger));
      const explicitlyRequested = requestedIds.includes(skill.id);
      return {
        id: skill.id,
        score: matchedTriggers.length + (explicitlyRequested ? 1000 : 0),
        matchedTriggers,
        explicitlyRequested,
      };
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (matches.length === 0) {
    return {
      status: 'NO_MATCH',
      registryVersion: registry.schemaVersion,
      query: request.query.trim(),
      orchestrator: registry.orchestrator,
      matchedSkills: [],
      orderedSkills: [{
        id: registry.orchestrator,
        path: byId.get(registry.orchestrator)!.path,
        role: 'orchestrator',
        loadedAs: 'ORCHESTRATOR',
      }],
      unresolved: ['NO_SPECIALIST_SKILL_MATCHED'],
      instructionLoading: 'HOST_RUNTIME_REQUIRED',
      execution: 'NOT_EXECUTED',
    };
  }

  const selected = new Set<string>();
  const ordered: string[] = [];
  const visiting = new Set<string>();

  const visit = (id: string): void => {
    if (selected.has(id)) return;
    if (visiting.has(id)) throw new SkillDispatchError(`SKILL_DEPENDENCY_CYCLE:${id}`);
    const skill = byId.get(id);
    if (!skill) throw new SkillDispatchError(`SKILL_ID_UNKNOWN:${id}`);

    visiting.add(id);
    for (const dependency of skill.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    selected.add(id);
    ordered.push(id);
  };

  for (const match of matches) visit(match.id);

  if (selected.size > maxSkills) {
    throw new SkillDispatchError('SKILL_PLAN_LIMIT_EXCEEDED');
  }

  const matchedIds = new Set(matches.map(match => match.id));
  const orderedSkills = [
    {
      id: registry.orchestrator,
      path: byId.get(registry.orchestrator)!.path,
      role: 'orchestrator' as const,
      loadedAs: 'ORCHESTRATOR' as const,
    },
    ...ordered
      .filter(id => id !== registry.orchestrator)
      .map(id => {
        const skill = byId.get(id)!;
        return {
          id,
          path: skill.path,
          role: skill.role,
          loadedAs: matchedIds.has(id) ? 'MATCH' as const : 'DEPENDENCY' as const,
        };
      }),
  ];

  return {
    status: 'READY',
    registryVersion: registry.schemaVersion,
    query: request.query.trim(),
    orchestrator: registry.orchestrator,
    matchedSkills: matches,
    orderedSkills,
    unresolved: [],
    instructionLoading: 'HOST_RUNTIME_REQUIRED',
    execution: 'NOT_EXECUTED',
  };
}
