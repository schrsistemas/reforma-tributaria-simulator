import { evaluateCreditEligibility, CREDIT_ELIGIBILITY_RULE_MATRIX } from '@rts/domain';
import { searchRag, getRagDocument } from './rag-repository.js';
import { resolvePublishedRuleSet } from './rule-catalog.js';
import { FISCAL_MCP_TOOLS, validateFiscalToolInput } from './fiscal-tool-catalog.js';
import type { AgentToolRunner } from './agent-host.js';

export interface FiscalToolEnvironment {
  DB?: D1Database;
}

export class FiscalToolExecutionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'FiscalToolExecutionError';
    this.code = code;
    this.status = status;
  }
}

function toCreditEligibilityInput(raw: Record<string, unknown>) {
  const categories = [
    'GOODS','RAW_MATERIALS','MACHINERY','SOFTWARE_TECHNOLOGY','ENERGY',
    'FREIGHT_LOGISTICS','CONTRACTED_SERVICES','COMMERCIAL_RENTAL','VEHICLE',
    'FUEL','FOOD','TRAVEL_HOSPITALITY','TELECOM','GIFT','JEWELRY',
    'ART_ANTIQUES','ALCOHOL','TOBACCO','WEAPONS_AMMUNITION',
    'RECREATIONAL_SPORTS_AESTHETIC','OTHER',
  ];
  const category = String(raw.category ?? '');
  if (!categories.includes(category)) throw new FiscalToolExecutionError('CREDIT_ELIGIBILITY_CATEGORY_INVALID');

  const enumField = (field: string, allowed: string[]): string | undefined => {
    if (raw[field] === undefined) return undefined;
    const value = String(raw[field]);
    if (!allowed.includes(value)) throw new FiscalToolExecutionError(`CREDIT_ELIGIBILITY_FIELD_INVALID:${field}`);
    return value;
  };
  const boolField = (field: string): boolean => {
    if (typeof raw[field] !== 'boolean') throw new FiscalToolExecutionError(`CREDIT_ELIGIBILITY_FIELD_BOOLEAN_REQUIRED:${field}`);
    return raw[field] as boolean;
  };
  const optionalBool = (field: string): boolean | undefined => {
    if (raw[field] === undefined) return undefined;
    return boolField(field);
  };

  return {
    category: category as Parameters<typeof evaluateCreditEligibility>[0]['category'],
    regularTaxpayer: boolField('regularTaxpayer'),
    electronicFiscalDocument: boolField('electronicFiscalDocument'),
    taxDebtExtinguished: boolField('taxDebtExtinguished'),
    extinctionRequirementWaived: optionalBool('extinctionRequirementWaived'),
    suppliedFreeOrBelowMarketToPerson: optionalBool('suppliedFreeOrBelowMarketToPerson'),
    economicActivityRelated: optionalBool('economicActivityRelated'),
    fuelSpecificRegime: optionalBool('fuelSpecificRegime'),
    relatedToPersonalConsumptionItem: optionalBool('relatedToPersonalConsumptionItem'),
    operationalPurpose: enumField('operationalPurpose', ['BUSINESS','PERSONAL','MIXED','UNKNOWN']) as 'BUSINESS' | 'PERSONAL' | 'MIXED' | 'UNKNOWN' | undefined,
    commercializedOrUsedForManufacturing: optionalBool('commercializedOrUsedForManufacturing'),
    usedBySecurityCompany: optionalBool('usedBySecurityCompany'),
    usedExclusivelyByCustomersOnPremises: optionalBool('usedExclusivelyByCustomersOnPremises'),
    serviceProvidedForConsiderationToCustomers: optionalBool('serviceProvidedForConsiderationToCustomers'),
    predominantActivityIsSameService: optionalBool('predominantActivityIsSameService'),
    workdayOnPremisesEmployeeProvision: optionalBool('workdayOnPremisesEmployeeProvision'),
    documentType: enumField('documentType', ['NFE','NFSE','CTE','CTE_OS','NFC_E','OTHER_ELECTRONIC']) as 'NFE' | 'NFSE' | 'CTE' | 'CTE_OS' | 'NFC_E' | 'OTHER_ELECTRONIC' | undefined,
    operationTaxTreatment: enumField('operationTaxTreatment', ['NORMAL','IMMUNE','EXEMPT','ZERO_RATE','DEFERRAL','SUSPENSION','OTHER']) as 'NORMAL' | 'IMMUNE' | 'EXEMPT' | 'ZERO_RATE' | 'DEFERRAL' | 'SUSPENSION' | 'OTHER' | undefined,
    ncm: typeof raw.ncm === 'string' ? raw.ncm.trim() || undefined : undefined,
    cfop: typeof raw.cfop === 'string' ? raw.cfop.trim() || undefined : undefined,
    itemDescription: typeof raw.itemDescription === 'string' ? raw.itemDescription.trim() || undefined : undefined,
  };
}

export interface FiscalToolResult {
  result: unknown;
  warnings: string[];
}

/** Executes only tools present in the MCP-call catalog after schema validation. */
export async function executeFiscalTool(
  env: FiscalToolEnvironment,
  toolName: string,
  rawInput: unknown,
): Promise<FiscalToolResult> {
  const validation = validateFiscalToolInput(toolName, rawInput);
  if (!validation.ok) {
    throw new FiscalToolExecutionError(
      validation.error,
      validation.error === 'MCP_TOOL_NOT_IMPLEMENTED' ? 501 : 400,
    );
  }

  const input = validation.input;
  const definition = FISCAL_MCP_TOOLS.find(tool => tool.name === toolName)!;
  if (definition.requiresDatabase && !env.DB) {
    throw new FiscalToolExecutionError('DATABASE_NOT_BOUND', 503);
  }

  if (toolName === 'fiscal.search_evidence') {
    const result = await searchRag(
      env.DB!,
      String(input.query),
      Number(input.limit ?? 5),
      input.asOf ? String(input.asOf) : undefined,
      input.sourceType ? String(input.sourceType) : undefined,
      input.jurisdiction ? String(input.jurisdiction) : undefined,
    );
    return { result, warnings: result.confidence === 'LOW' ? ['EVIDENCE_CONFIDENCE_LOW'] : [] };
  }

  if (toolName === 'fiscal.get_document') {
    const result = await getRagDocument(env.DB!, String(input.documentId));
    if (!result) throw new FiscalToolExecutionError('EVIDENCE_DOCUMENT_NOT_FOUND', 404);
    return { result, warnings: [] };
  }

  if (toolName === 'fiscal.get_split_payment_rules') {
    const query = String(input.query ?? 'Split Payment IBS CBS').trim() || 'Split Payment IBS CBS';
    const result = await searchRag(
      env.DB!,
      query,
      Number(input.limit ?? 5),
      input.asOf ? String(input.asOf) : undefined,
    );
    return { result, warnings: result.confidence === 'LOW' ? ['EVIDENCE_CONFIDENCE_LOW'] : [] };
  }

  if (toolName === 'fiscal.get_credit_eligibility_rules') {
    return { result: { rules: CREDIT_ELIGIBILITY_RULE_MATRIX }, warnings: [] };
  }

  if (toolName === 'fiscal.evaluate_credit_eligibility') {
    const result = evaluateCreditEligibility(toCreditEligibilityInput(input));
    return { result, warnings: result.warnings };
  }

  if (toolName === 'fiscal.resolve_ruleset') {
    const referenceDate = String(input.asOf ?? new Date().toISOString().slice(0, 10));
    const result = await resolvePublishedRuleSet(
      env,
      referenceDate,
      input.rulesetId ? String(input.rulesetId) : undefined,
      input.version ? String(input.version) : undefined,
    );
    return { result, warnings: [] };
  }

  throw new FiscalToolExecutionError('MCP_TOOL_NOT_IMPLEMENTED', 501);
}

/** Adapter consumed directly by the provider-neutral Agent Host. */
export function createFiscalAgentToolRunner(env: FiscalToolEnvironment): AgentToolRunner {
  return {
    async execute(toolName, input, context) {
      if (context.signal.aborted) throw new FiscalToolExecutionError('AGENT_EXECUTION_ABORTED', 408);
      const output = await executeFiscalTool(env, toolName, input);
      return {
        result: output.result,
        warnings: output.warnings,
        provenance: {
          tenantId: context.tenantId,
          requestId: context.requestId,
          correlationId: context.correlationId,
          toolName,
        },
      };
    },
  };
}
