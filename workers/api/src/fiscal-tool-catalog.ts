/**
 * Single source of truth for the MCP-call tools implemented in this Worker.
 * The catalog intentionally excludes tools that only have a separate HTTP
 * transport or are still waiting for external configuration.
 */
export interface FiscalToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: 'string' | 'integer' | 'boolean';
      description?: string;
      enum?: string[];
      pattern?: string;
      minimum?: number;
      maximum?: number;
    }>;
    required: string[];
    additionalProperties: false;
  };
  requiresDatabase: boolean;
}

const dateProperty = {
  type: 'string' as const,
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description: 'Data de referência fiscal no formato YYYY-MM-DD.',
};

export const FISCAL_MCP_TOOLS: FiscalToolDefinition[] = [
  {
    name: 'fiscal.search_evidence',
    description: 'Pesquisa evidências fiscais no índice RAG, respeitando vigência e proveniência.',
    requiresDatabase: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Consulta fiscal não vazia.' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
        asOf: dateProperty,
        sourceType: { type: 'string' },
        jurisdiction: { type: 'string' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'fiscal.get_document',
    description: 'Recupera documento fiscal e seus trechos indexados por identificador.',
    requiresDatabase: true,
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string' } },
      required: ['documentId'],
      additionalProperties: false,
    },
  },
  {
    name: 'fiscal.get_split_payment_rules',
    description: 'Pesquisa evidências normativas relacionadas ao Split Payment.',
    requiresDatabase: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
        asOf: dateProperty,
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'fiscal.get_credit_eligibility_rules',
    description: 'Retorna a matriz determinística de regras de elegibilidade de crédito.',
    requiresDatabase: false,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'fiscal.evaluate_credit_eligibility',
    description: 'Avalia elegibilidade de crédito com base no contexto informado.',
    requiresDatabase: false,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['GOODS','RAW_MATERIALS','MACHINERY','SOFTWARE_TECHNOLOGY','ENERGY','FREIGHT_LOGISTICS','CONTRACTED_SERVICES','COMMERCIAL_RENTAL','VEHICLE','FUEL','FOOD','TRAVEL_HOSPITALITY','TELECOM','GIFT','JEWELRY','ART_ANTIQUES','ALCOHOL','TOBACCO','WEAPONS_AMMUNITION','RECREATIONAL_SPORTS_AESTHETIC','OTHER'],
        },
        regularTaxpayer: { type: 'boolean' },
        electronicFiscalDocument: { type: 'boolean' },
        taxDebtExtinguished: { type: 'boolean' },
        extinctionRequirementWaived: { type: 'boolean' },
        suppliedFreeOrBelowMarketToPerson: { type: 'boolean' },
        economicActivityRelated: { type: 'boolean' },
        fuelSpecificRegime: { type: 'boolean' },
        relatedToPersonalConsumptionItem: { type: 'boolean' },
        commercializedOrUsedForManufacturing: { type: 'boolean' },
        usedBySecurityCompany: { type: 'boolean' },
        usedExclusivelyByCustomersOnPremises: { type: 'boolean' },
        serviceProvidedForConsiderationToCustomers: { type: 'boolean' },
        predominantActivityIsSameService: { type: 'boolean' },
        workdayOnPremisesEmployeeProvision: { type: 'boolean' },
        operationalPurpose: { type: 'string', enum: ['BUSINESS','PERSONAL','MIXED','UNKNOWN'] },
        documentType: { type: 'string', enum: ['NFE','NFSE','CTE','CTE_OS','NFC_E','OTHER_ELECTRONIC'] },
        operationTaxTreatment: { type: 'string', enum: ['NORMAL','IMMUNE','EXEMPT','ZERO_RATE','DEFERRAL','SUSPENSION','OTHER'] },
        ncm: { type: 'string' },
        cfop: { type: 'string' },
        itemDescription: { type: 'string' },
      },
      required: ['category','regularTaxpayer','electronicFiscalDocument','taxDebtExtinguished'],
      additionalProperties: false,
    },
  },
  {
    name: 'fiscal.resolve_ruleset',
    description: 'Resolve RuleSet publicado e regras vigentes na data de referência.',
    requiresDatabase: true,
    inputSchema: {
      type: 'object',
      properties: {
        asOf: dateProperty,
        rulesetId: { type: 'string' },
        version: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

export function validateFiscalToolInput(
  toolName: string,
  input: unknown,
): { ok: true; input: Record<string, unknown> } | { ok: false; error: string } {
  const definition = FISCAL_MCP_TOOLS.find(tool => tool.name === toolName);
  if (!definition) return { ok: false, error: 'MCP_TOOL_NOT_IMPLEMENTED' };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'MCP_TOOL_INPUT_MUST_BE_OBJECT' };
  }

  const value = input as Record<string, unknown>;
  const properties = definition.inputSchema.properties;
  for (const key of Object.keys(value)) {
    if (!(key in properties)) return { ok: false, error: `MCP_TOOL_INPUT_FIELD_NOT_ALLOWED:${key}` };
  }
  for (const key of definition.inputSchema.required) {
    if (value[key] === undefined || value[key] === null || value[key] === '') {
      return { ok: false, error: `MCP_TOOL_INPUT_REQUIRED:${key}` };
    }
  }
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue;
    const schema = properties[key];
    if (schema.type === 'string' && typeof item !== 'string') {
      return { ok: false, error: `MCP_TOOL_INPUT_TYPE_INVALID:${key}` };
    }
    if (schema.type === 'integer' && (!Number.isInteger(item) || typeof item !== 'number')) {
      return { ok: false, error: `MCP_TOOL_INPUT_TYPE_INVALID:${key}` };
    }
    if (schema.type === 'boolean' && typeof item !== 'boolean') {
      return { ok: false, error: `MCP_TOOL_INPUT_TYPE_INVALID:${key}` };
    }
    if (schema.enum && (typeof item !== 'string' || !schema.enum.includes(item))) {
      return { ok: false, error: `MCP_TOOL_INPUT_ENUM_INVALID:${key}` };
    }
    if (schema.pattern && typeof item === 'string' && !new RegExp(schema.pattern).test(item)) {
      return { ok: false, error: `MCP_TOOL_INPUT_FORMAT_INVALID:${key}` };
    }
    if (schema.minimum !== undefined && typeof item === 'number' && item < schema.minimum) {
      return { ok: false, error: `MCP_TOOL_INPUT_MINIMUM_INVALID:${key}` };
    }
    if (schema.maximum !== undefined && typeof item === 'number' && item > schema.maximum) {
      return { ok: false, error: `MCP_TOOL_INPUT_MAXIMUM_INVALID:${key}` };
    }
  }

  if (toolName === 'fiscal.search_evidence' && typeof value.query === 'string' && !value.query.trim()) {
    return { ok: false, error: 'MCP_TOOL_INPUT_REQUIRED:query' };
  }
  if (toolName === 'fiscal.get_document' && typeof value.documentId === 'string' && !value.documentId.trim()) {
    return { ok: false, error: 'MCP_TOOL_INPUT_REQUIRED:documentId' };
  }
  return { ok: true, input: value };
}

export function getFiscalMcpToolCatalog(databaseConfigured: boolean) {
  return FISCAL_MCP_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    status: tool.requiresDatabase && !databaseConfigured ? 'DATABASE_REQUIRED' : 'AVAILABLE',
  }));
}
