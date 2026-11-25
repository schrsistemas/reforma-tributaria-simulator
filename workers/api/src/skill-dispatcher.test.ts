import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSkillPlan,
  SkillDispatchError,
  type SkillRegistry,
} from './skill-dispatcher.js';

const registry: SkillRegistry = {
  schemaVersion: 'test',
  orchestrator: 'orchestrator',
  skills: [
    { id: 'orchestrator', path: 'skills/orchestrator/SKILL.md', role: 'orchestrator', triggers: [] },
    { id: 'evidence', path: 'skills/evidence/SKILL.md', role: 'capability', triggers: ['legislação'], dependsOn: [] },
    { id: 'calculation', path: 'skills/calculation/SKILL.md', role: 'capability', triggers: ['cálculo fiscal'], dependsOn: ['evidence'] },
    { id: 'ibs-cbs', path: 'skills/ibs-cbs/SKILL.md', role: 'domain', triggers: ['IBS', 'CBS', 'transição'], dependsOn: ['evidence', 'calculation'] },
    { id: 'documents', path: 'skills/documents/SKILL.md', role: 'domain', triggers: ['NF-e', 'XML'], dependsOn: ['evidence'] },
  ],
};

test('matches Portuguese tax request and expands transitive dependencies once', () => {
  const plan = resolveSkillPlan({ query: 'Explique o cálculo de IBS e CBS na transição' }, registry);

  assert.equal(plan.status, 'READY');
  assert.deepEqual(plan.matchedSkills.map(skill => skill.id), ['ibs-cbs']);
  assert.deepEqual(plan.orderedSkills.map(skill => skill.id), ['orchestrator', 'evidence', 'calculation', 'ibs-cbs']);
  assert.equal(new Set(plan.orderedSkills.map(skill => skill.id)).size, plan.orderedSkills.length);
  assert.equal(plan.execution, 'NOT_EXECUTED');
  assert.equal(plan.instructionLoading, 'HOST_RUNTIME_REQUIRED');
});

test('resolves multiple domains and deduplicates shared dependencies', () => {
  const plan = resolveSkillPlan({ query: 'Validar NF-e XML e legislação IBS' }, registry);
  const ids = plan.orderedSkills.map(skill => skill.id);

  assert.deepEqual(plan.matchedSkills.map(skill => skill.id), ['ibs-cbs', 'documents']);
  assert.equal(ids.filter(id => id === 'evidence').length, 1);
  assert.ok(ids.indexOf('evidence') < ids.indexOf('ibs-cbs'));
  assert.ok(ids.indexOf('evidence') < ids.indexOf('documents'));
});

test('supports explicit skill selection without trigger match', () => {
  const plan = resolveSkillPlan({
    query: 'análise especial solicitada',
    requestedSkillIds: ['documents', 'documents'],
  }, registry);

  assert.deepEqual(plan.matchedSkills.map(skill => skill.id), ['documents']);
  assert.equal(plan.matchedSkills[0].explicitlyRequested, true);
});

test('returns a safe no-match plan', () => {
  const plan = resolveSkillPlan({ query: 'assunto sem relação tributária' }, registry);
  assert.equal(plan.status, 'NO_MATCH');
  assert.deepEqual(plan.orderedSkills.map(skill => skill.id), ['orchestrator']);
  assert.deepEqual(plan.unresolved, ['NO_SPECIALIST_SKILL_MATCHED']);
});

test('rejects unknown requested skill ids', () => {
  assert.throws(
    () => resolveSkillPlan({ query: 'qualquer coisa', requestedSkillIds: ['missing'] }, registry),
    (error: unknown) => error instanceof SkillDispatchError && error.code === 'SKILL_ID_UNKNOWN:missing',
  );
});

test('rejects dependency cycles', () => {
  const cyclic: SkillRegistry = {
    ...registry,
    skills: [
      ...registry.skills.filter(skill => skill.id === 'orchestrator'),
      { id: 'a', path: 'a/SKILL.md', role: 'domain', triggers: ['tema'], dependsOn: ['b'] },
      { id: 'b', path: 'b/SKILL.md', role: 'capability', triggers: [], dependsOn: ['a'] },
    ],
  };

  assert.throws(
    () => resolveSkillPlan({ query: 'tema' }, cyclic),
    (error: unknown) => error instanceof SkillDispatchError && error.code.startsWith('SKILL_DEPENDENCY_CYCLE:'),
  );
});

test('rejects missing registry dependencies', () => {
  const invalid: SkillRegistry = {
    ...registry,
    skills: [
      ...registry.skills.filter(skill => skill.id === 'orchestrator'),
      { id: 'broken', path: 'broken/SKILL.md', role: 'domain', triggers: ['tema'], dependsOn: ['absent'] },
    ],
  };

  assert.throws(
    () => resolveSkillPlan({ query: 'tema' }, invalid),
    (error: unknown) => error instanceof SkillDispatchError && error.code === 'SKILL_DEPENDENCY_NOT_FOUND:broken:absent',
  );
});

test('rejects empty query and invalid plan limits', () => {
  assert.throws(() => resolveSkillPlan({ query: '  ' }, registry), /SKILL_QUERY_REQUIRED/);
  assert.throws(() => resolveSkillPlan({ query: 'tema', maxSkills: 0 }, registry), /SKILL_MAXIMUM_INVALID/);
  assert.throws(() => resolveSkillPlan({ query: 'tema', maxSkills: 1 }, registry), /SKILL_PLAN_LIMIT_EXCEEDED/);
});
