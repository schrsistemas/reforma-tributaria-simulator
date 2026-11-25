import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FISCAL_MCP_TOOLS,
  getFiscalMcpToolCatalog,
  validateFiscalToolInput,
} from './fiscal-tool-catalog.js';

test('catalog exposes only tools implemented by the MCP call dispatcher', () => {
  const names = FISCAL_MCP_TOOLS.map(tool => tool.name);
  assert.deepEqual(names, [
    'fiscal.search_evidence',
    'fiscal.get_document',
    'fiscal.get_split_payment_rules',
    'fiscal.get_credit_eligibility_rules',
    'fiscal.evaluate_credit_eligibility',
    'fiscal.resolve_ruleset',
  ]);
});

test('database-dependent tools report unavailable without D1', () => {
  const catalog = getFiscalMcpToolCatalog(false);
  assert.equal(catalog.find(tool => tool.name === 'fiscal.search_evidence')?.status, 'DATABASE_REQUIRED');
  assert.equal(catalog.find(tool => tool.name === 'fiscal.resolve_ruleset')?.status, 'DATABASE_REQUIRED');
  assert.equal(catalog.find(tool => tool.name === 'fiscal.evaluate_credit_eligibility')?.status, 'AVAILABLE');
  assert.equal(catalog.find(tool => tool.name === 'fiscal.get_credit_eligibility_rules')?.status, 'AVAILABLE');
});

test('accepts valid RAG search input and rejects blank query', () => {
  assert.equal(validateFiscalToolInput('fiscal.search_evidence', { query: 'IBS CBS', limit: 5, asOf: '2027-01-01' }).ok, true);
  assert.deepEqual(validateFiscalToolInput('fiscal.search_evidence', { query: '  ' }), {
    ok: false,
    error: 'MCP_TOOL_INPUT_REQUIRED:query',
  });
});

test('rejects unknown tools and arbitrary input properties', () => {
  assert.deepEqual(validateFiscalToolInput('fiscal.unknown', {}), {
    ok: false,
    error: 'MCP_TOOL_NOT_IMPLEMENTED',
  });
  assert.deepEqual(validateFiscalToolInput('fiscal.get_document', { documentId: 'doc-1', tenantId: 'other' }), {
    ok: false,
    error: 'MCP_TOOL_INPUT_FIELD_NOT_ALLOWED:tenantId',
  });
});

test('validates dates, numeric bounds and input types', () => {
  assert.equal(validateFiscalToolInput('fiscal.search_evidence', { query: 'IBS', limit: 11 }).ok, false);
  assert.equal(validateFiscalToolInput('fiscal.resolve_ruleset', { asOf: '01/01/2027' }).ok, false);
  assert.equal(validateFiscalToolInput('fiscal.get_document', { documentId: 42 }).ok, false);
});

test('validates typed booleans and required credit eligibility fields', () => {
  const valid = {
    category: 'GOODS',
    regularTaxpayer: true,
    electronicFiscalDocument: true,
    taxDebtExtinguished: false,
  };
  assert.equal(validateFiscalToolInput('fiscal.evaluate_credit_eligibility', valid).ok, true);
  assert.equal(validateFiscalToolInput('fiscal.evaluate_credit_eligibility', {
    ...valid,
    regularTaxpayer: 'true',
  }).ok, false);
  assert.equal(validateFiscalToolInput('fiscal.evaluate_credit_eligibility', {
    category: 'INVALID',
    regularTaxpayer: true,
    electronicFiscalDocument: true,
    taxDebtExtinguished: false,
  }).ok, false);
});


test('rejects impossible calendar dates and oversized or blank string inputs', () => {
  assert.equal(validateFiscalToolInput('fiscal.resolve_ruleset', { asOf: '2027-02-29' }).ok, false);
  assert.equal(validateFiscalToolInput('fiscal.resolve_ruleset', { asOf: '2028-02-29' }).ok, true);
  assert.equal(validateFiscalToolInput('fiscal.search_evidence', { query: 'x'.repeat(501) }).ok, false);
  assert.equal(validateFiscalToolInput('fiscal.get_document', { documentId: '   ' }).ok, false);
  assert.equal(validateFiscalToolInput('fiscal.get_document', { documentId: 'd'.repeat(129) }).ok, false);
});
test('allows no-argument credit rule lookup but rejects extra arguments', () => {
  assert.equal(validateFiscalToolInput('fiscal.get_credit_eligibility_rules', {}).ok, true);
  assert.equal(validateFiscalToolInput('fiscal.get_credit_eligibility_rules', { includeDrafts: true }).ok, false);
});
