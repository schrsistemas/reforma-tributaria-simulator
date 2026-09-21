import { executeSimulation, type SimulationRequest } from './simulation.js';
import { resolvePublishedRuleSet } from './rule-catalog.js';
import { findById, findByIdempotency, saveCompleted } from './simulation-repository.js';
import { createSplitPayment, getSplitPayment, settleSplitPayment, reverseSplitPayment, reconcileSplitPayment } from './split-payment-repository.js';
import { listFiscalSources, getFiscalSource } from './fiscal-knowledge.js';
import { collectFiscalSource } from './source-collector.js';
import { listGovernmentSources } from './government-source-repository.js';
import { collectGovernmentSource, collectEnabledGovernmentSources } from './government-collection.js';
import { createTef, getTef, transitionTefRecord } from './tef-repository.js';
import { createPix, getPix, transitionPixRecord } from './pix-repository.js';
import { searchRag, getRagDocument } from './rag-repository.js';
import { evaluateCreditEligibility } from '@rts/domain';
import { listPaymentMethods, listPaymentRejectionScenarios, createPaymentRejectionSimulation, getPaymentRejectionSimulation, listPaymentRejectionSimulations } from './payment-rejection-repository.js';

export interface Env {
  VERSION: string;
  DB?: D1Database;
  SIMULATION_WORKFLOW?: WorkflowBinding;
  INTEGRATION_TOKEN?: string;
  EVIDENCE_BUCKET?: R2Bucket;
}
interface WorkflowBinding {
  create(options: { id?: string; params: unknown }): Promise<{ id: string; status: string }>;
}

const json = (body: unknown, status = 200, request?: Request) => {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  const correlationId = request?.headers.get('X-Correlation-Id');
  if (correlationId) headers.set('X-Correlation-Id', correlationId);
  return new Response(JSON.stringify(body), { status, headers });
};

function integrationHeaders(request: Request) {
  const correlationId = request.headers.get('X-Correlation-Id');
  const idempotencyKey = request.headers.get('Idempotency-Key');
  const tenantId = request.headers.get('X-Zynkronyx-Tenant');
  if (!correlationId || !tenantId) {
    throw Object.assign(new Error('Missing integration headers'), { status: 400 });
  }
  return { correlationId, idempotencyKey, tenantId };
}

function authenticate(request: Request, env: Env) {
  if (!env.INTEGRATION_TOKEN) {
    throw Object.assign(new Error('INTEGRATION_AUTH_NOT_CONFIGURED'), { status: 503 });
  }
  const authorization = request.headers.get('Authorization');
  if (authorization !== `Bearer ${env.INTEGRATION_TOKEN}`) {
    throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 });
  }
}

async function readJson(request: Request) {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > 1_000_000) {
    throw Object.assign(new Error('Payload too large'), { status: 413 });
  }
  return request.json();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ status: 'ok', service: 'reforma-tributaria-simulator', version: env.VERSION ?? 'dev' }, 200, request);
    }

    if (request.method === 'GET' && url.pathname === '/api/v1') {
      return json({
        service: 'reforma-tributaria-simulator',
        apiVersion: 'v1',
        capabilities: ['simulation', 'tax-engine', 'split-payment', 'tef', 'pix', 'fiscal-knowledge', 'government-source-registry', 'official-consumption-calculator', 'credit-eligibility'],
        execution: { explicitScenario: true, durableWorkflow: Boolean(env.SIMULATION_WORKFLOW) },
      }, 200, request);
    }

    try {
      authenticate(request, env);
    } catch (error) {
      const status = Number((error as { status?: number }).status) || 500;
      return json({ ok: false, error: error instanceof Error ? error.message : 'AUTHENTICATION_FAILED' }, status, request);
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/mcp/tools') {
      return json({
        ok: true,
        protocol: 'MCP-compatible fiscal tool catalog',
        tools: [
          { name: 'fiscal.search_evidence', transport: 'POST /api/v1/mcp/call', status: 'AVAILABLE' },
          { name: 'fiscal.get_document', transport: 'POST /api/v1/mcp/call', status: 'AVAILABLE' },
          { name: 'fiscal.resolve_ruleset', transport: 'POST /api/v1/mcp/call', status: 'AVAILABLE' },
          { name: 'fiscal.calculate', transport: 'POST /api/v1/simulations', status: 'AVAILABLE' },
          { name: 'fiscal.compare_calculation', transport: 'POST /api/v1/official-calculator/regime-geral', status: 'AVAILABLE' },
          { name: 'fiscal.get_split_payment_rules', transport: 'POST /api/v1/mcp/call', status: 'AVAILABLE' },
          { name: 'fiscal.get_snapshot', transport: 'GET /api/v1/simulations/:id', status: 'AVAILABLE' },
          { name: 'payments.list_methods', transport: 'GET /api/v1/payment-methods', status: 'AVAILABLE' },
          { name: 'payments.list_rejection_scenarios', transport: 'GET /api/v1/payment-rejections/scenarios', status: 'AVAILABLE' },
          { name: 'payments.simulate_rejection', transport: 'POST /api/v1/payment-rejections/simulations', status: 'AVAILABLE' },
          { name: 'payments.get_rejection_simulation', transport: 'GET /api/v1/payment-rejections/simulations/:id', status: 'AVAILABLE' }
        ]
      }, 200, request);
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/mcp/call') {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ ok: false, error: 'DATABASE_NOT_BOUND' }, 503, request);
        const body = await readJson(request) as { requestId?: string; correlationId?: string; toolName?: string; input?: Record<string, unknown> };
        const requestId = body.requestId ?? crypto.randomUUID();
        const correlationId = body.correlationId ?? headers.correlationId;
        const toolName = body.toolName;
        const input = body.input ?? {};
        if (!toolName) return json({ requestId, correlationId, outcome: 'ERROR', errorCode: 'MCP_TOOL_REQUIRED', warnings: [], finishedAt: new Date().toISOString() }, 400, request);
        if (toolName === 'fiscal.search_evidence') {
          const query = String(input.query ?? '').trim();
          if (!query) return json({ requestId, correlationId, outcome: 'ERROR', errorCode: 'RAG_QUERY_REQUIRED', warnings: [], finishedAt: new Date().toISOString() }, 400, request);
          const result = await searchRag(env.DB, query, Number(input.limit ?? 5), input.asOf ? String(input.asOf) : undefined, input.sourceType ? String(input.sourceType) : undefined, input.jurisdiction ? String(input.jurisdiction) : undefined);
          return json({ requestId, correlationId, outcome: 'SUCCESS', result, warnings: result.confidence === 'LOW' ? ['EVIDENCE_CONFIDENCE_LOW'] : [], finishedAt: new Date().toISOString() }, 200, request);
        }
        if (toolName === 'fiscal.get_document') {
          const documentId = String(input.documentId ?? '').trim();
          if (!documentId) return json({ requestId, correlationId, outcome: 'ERROR', errorCode: 'DOCUMENT_ID_REQUIRED', warnings: [], finishedAt: new Date().toISOString() }, 400, request);
          const result = await getRagDocument(env.DB, documentId);
          if (!result) return json({ requestId, correlationId, outcome: 'ERROR', errorCode: 'EVIDENCE_DOCUMENT_NOT_FOUND', warnings: [], finishedAt: new Date().toISOString() }, 404, request);
          return json({ requestId, correlationId, outcome: 'SUCCESS', result, warnings: [], finishedAt: new Date().toISOString() }, 200, request);
        }
        if (toolName === 'fiscal.get_split_payment_rules') {
          const query = String(input.query ?? 'Split Payment IBS CBS').trim() || 'Split Payment IBS CBS';
          const result = await searchRag(env.DB, query, Number(input.limit ?? 5), input.asOf ? String(input.asOf) : undefined);
          return json({ requestId, correlationId, outcome: 'SUCCESS', result, warnings: result.confidence === 'LOW' ? ['EVIDENCE_CONFIDENCE_LOW'] : [], finishedAt: new Date().toISOString() }, 200, request);
        }
        if (toolName === 'fiscal.resolve_ruleset') {
          const referenceDate = String(input.asOf ?? new Date().toISOString().slice(0, 10));
          const result = await resolvePublishedRuleSet(env, referenceDate, input.rulesetId ? String(input.rulesetId) : undefined, input.version ? String(input.version) : undefined);
          return json({ requestId, correlationId, outcome: 'SUCCESS', result, warnings: [], finishedAt: new Date().toISOString() }, 200, request);
        }
        return json({ requestId, correlationId, outcome: 'ERROR', errorCode: 'MCP_TOOL_NOT_IMPLEMENTED', warnings: ['Use /api/v1/mcp/tools for the current catalog.'], finishedAt: new Date().toISOString() }, 501, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, outcome: 'ERROR', errorCode: error instanceof Error ? error.message : 'MCP_CALL_FAILED', warnings: [], finishedAt: new Date().toISOString() }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/official-calculator/regime-geral') {
      try {
        integrationHeaders(request);
        const body = await readJson(request);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch('https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/regime-geral', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          const text = await response.text();
          const headers = new Headers({ 'content-type': response.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' });
          const correlationId = request.headers.get('X-Correlation-Id');
          if (correlationId) headers.set('X-Correlation-Id', correlationId);
          return new Response(text, { status: response.status, headers });
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        const status = error instanceof Error && error.name === 'AbortError' ? 504 : (Number((error as { status?: number }).status) || 502);
        return json({ ok: false, error: error instanceof Error ? error.message : 'OFFICIAL_CALCULATOR_UNAVAILABLE' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/government/sources') {
      try {
        integrationHeaders(request);
        const jurisdictionLevel = url.searchParams.get('jurisdictionLevel') as 'FEDERAL' | 'STATE' | 'MUNICIPAL' | null;
        const stateCode = url.searchParams.get('stateCode') ?? undefined;
        const sources = await listGovernmentSources(env, {
          jurisdictionLevel: jurisdictionLevel ?? undefined,
          stateCode,
        });
        return json({ ok: true, sources }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'GOVERNMENT_SOURCE_REGISTRY_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/government/sources/')) {
      try {
        integrationHeaders(request);
        const sourceId = decodeURIComponent(url.pathname.split('/').pop()!);
        const sources = await listGovernmentSources(env);
        const source = sources.find(item => item.id === sourceId);
        if (!source) return json({ ok: false, error: 'GOVERNMENT_SOURCE_NOT_FOUND' }, 404, request);
        return json({ ok: true, source }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'GOVERNMENT_SOURCE_REGISTRY_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/v1/government/sources/') && url.pathname.endsWith('/collect')) {
      try {
        integrationHeaders(request);
        const parts = url.pathname.split('/');
        const sourceId = decodeURIComponent(parts[parts.length - 2]);
        const sources = await listGovernmentSources(env);
        const source = sources.find(item => item.id === sourceId);
        if (!source) return json({ ok: false, error: 'GOVERNMENT_SOURCE_NOT_FOUND' }, 404, request);
        return json(await collectGovernmentSource(env, source), 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'GOVERNMENT_COLLECTION_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/fiscal-sources') {
      try {
        integrationHeaders(request);
        return json({ ok: true, sources: await listFiscalSources(env) }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SOURCE_REGISTRY_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/fiscal-sources/')) {
      try {
        integrationHeaders(request);
        const sourceId = decodeURIComponent(url.pathname.split('/').pop()!);
        const source = await getFiscalSource(env, sourceId);
        if (!source) return json({ error: 'FISCAL_SOURCE_NOT_FOUND' }, 404, request);
        return json({ ok: true, source }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SOURCE_REGISTRY_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/pix/transactions') {
      try {
        const headers=integrationHeaders(request); if(!headers.idempotencyKey)return json({error:'IDEMPOTENCY_KEY_REQUIRED'},400,request);
        if(!env.DB)return json({error:'DATABASE_NOT_BOUND'},503,request);
        const body=await readJson(request) as {operationId:string;amountMinor:number;provider?:string};
        if(!body.operationId||!Number.isInteger(body.amountMinor)||body.amountMinor<0)return json({error:'PIX_FIELDS_REQUIRED'},400,request);
        const result=await createPix(env.DB,{tenantId:headers.tenantId,operationId:body.operationId,idempotencyKey:headers.idempotencyKey,amountMinor:body.amountMinor,correlationId:headers.correlationId,provider:body.provider});
        return json({ok:true,...result,correlationId:headers.correlationId},result.replayed?200:201,request);
      }catch(error){const status=Number((error as {status?:number}).status)||400;return json({ok:false,error:error instanceof Error?error.message:'PIX_CREATE_FAILED'},status,request);}
    }
    if(request.method==='GET'&&url.pathname.startsWith('/api/v1/pix/transactions/')){
      try{const h=integrationHeaders(request);if(!env.DB)return json({error:'DATABASE_NOT_BOUND'},503,request);const id=decodeURIComponent(url.pathname.split('/').pop()!);const transaction=await getPix(env.DB,h.tenantId,id);if(!transaction)return json({error:'PIX_TRANSACTION_NOT_FOUND'},404,request);return json({ok:true,transaction},200,request);}
      catch(error){const status=Number((error as {status?:number}).status)||400;return json({ok:false,error:error instanceof Error?error.message:'PIX_LOOKUP_FAILED'},status,request);}
    }
    if(request.method==='POST'&&url.pathname.startsWith('/api/v1/pix/transactions/')&&url.pathname.endsWith('/transition')){
      try{const h=integrationHeaders(request);if(!env.DB)return json({error:'DATABASE_NOT_BOUND'},503,request);const parts=url.pathname.split('/');const id=decodeURIComponent(parts[parts.length-2]);const body=await readJson(request) as {to:import('@rts/domain').PixTransactionStatus};if(!body.to)return json({error:'PIX_TARGET_STATUS_REQUIRED'},400,request);const transaction=await transitionPixRecord(env.DB,h.tenantId,id,body.to,h.correlationId);if(!transaction)return json({error:'PIX_TRANSACTION_NOT_FOUND'},404,request);return json({ok:true,transaction,correlationId:h.correlationId},200,request);}
      catch(error){const status=Number((error as {status?:number}).status)||400;return json({ok:false,error:error instanceof Error?error.message:'PIX_TRANSITION_FAILED'},status,request);}
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/tef/transactions') {
      try {
        const headers = integrationHeaders(request);
        if (!headers.idempotencyKey) return json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400, request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const body = await readJson(request) as { operationId: string; amountMinor: number; type?: 'SALE'|'REFUND'|'CANCELLATION'|'REVERSAL'; provider?: string; terminalId?: string };
        if (!body.operationId || !Number.isInteger(body.amountMinor) || body.amountMinor < 0) {
          return json({ error: 'TEF_FIELDS_REQUIRED' }, 400, request);
        }
        const result = await createTef(env.DB, {
          tenantId: headers.tenantId, operationId: body.operationId, idempotencyKey: headers.idempotencyKey,
          provider: body.provider ?? 'SIM-TEF', terminalId: body.terminalId ?? 'TERM-001',
          type: body.type ?? 'SALE', amountMinor: body.amountMinor, correlationId: headers.correlationId,
        });
        return json({ ok: true, ...result, correlationId: headers.correlationId }, result.replayed ? 200 : 201, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'TEF_CREATE_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/tef/transactions/')) {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const parts = url.pathname.split('/');
        const id = decodeURIComponent(parts[parts.length - 1]);
        const transaction = await getTef(env.DB, headers.tenantId, id);
        if (!transaction) return json({ error: 'TEF_TRANSACTION_NOT_FOUND' }, 404, request);
        return json({ ok: true, transaction }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'TEF_LOOKUP_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/v1/tef/transactions/') && url.pathname.endsWith('/transition')) {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const parts = url.pathname.split('/');
        const id = decodeURIComponent(parts[parts.length - 2]);
        const body = await readJson(request) as { to: import('@rts/domain').TefTransactionStatus };
        if (!body.to) return json({ error: 'TEF_TARGET_STATUS_REQUIRED' }, 400, request);
        const transaction = await transitionTefRecord(env.DB, headers.tenantId, id, body.to, headers.correlationId);
        if (!transaction) return json({ error: 'TEF_TRANSACTION_NOT_FOUND' }, 404, request);
        return json({ ok: true, transaction, correlationId: headers.correlationId }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'TEF_TRANSITION_FAILED' }, status, request);
      }
    }


    if (request.method === 'POST' && url.pathname === '/api/v1/credit-eligibility') {
      try {
        const headers = integrationHeaders(request);
        const body = await readJson(request) as Parameters<typeof evaluateCreditEligibility>[0];
        const result = evaluateCreditEligibility(body);
        return json({
          ok: true,
          ...result,
          correlationId: headers.correlationId,
          disclaimer: 'Resultado determinístico baseado nas regras modeladas da LC 214/2025 compilada; exceções regulamentares e fatos não informados podem exigir análise adicional.',
        }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'CREDIT_ELIGIBILITY_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/payment-methods') {
      try {
        integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        return json({ ok: true, paymentMethods: await listPaymentMethods(env.DB) }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'PAYMENT_METHODS_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/payment-rejections/scenarios') {
      try {
        integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const paymentMethodCode = url.searchParams.get('paymentMethodCode') ?? undefined;
        return json({
          ok: true,
          scenarios: await listPaymentRejectionScenarios(env.DB, paymentMethodCode),
          disclaimer: 'Scenarios in this endpoint are simulation data unless an individual scenario is explicitly linked to official evidence.',
        }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'PAYMENT_REJECTION_SCENARIOS_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/payment-rejections/simulations') {
      try {
        const headers = integrationHeaders(request);
        if (!headers.idempotencyKey) return json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400, request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);

        const body = await readJson(request) as {
          operationId?: string;
          paymentMethodCode?: import('@rts/domain').PaymentMethodCode;
          rejectionScenarioId?: string;
          amountMinor?: number;
          paymentId?: string;
        };

        if (!body.operationId || !body.paymentMethodCode || !body.rejectionScenarioId) {
          return json({ error: 'PAYMENT_REJECTION_FIELDS_REQUIRED' }, 400, request);
        }

        if (!Number.isInteger(body.amountMinor) || Number(body.amountMinor) < 0) {
          return json({ error: 'PAYMENT_REJECTION_AMOUNT_INVALID' }, 400, request);
        }

        const result = await createPaymentRejectionSimulation(env.DB, {
          tenantId: headers.tenantId,
          operationId: body.operationId,
          idempotencyKey: headers.idempotencyKey,
          paymentMethodCode: body.paymentMethodCode,
          rejectionScenarioId: body.rejectionScenarioId,
          amountMinor: Number(body.amountMinor),
          correlationId: headers.correlationId,
          paymentId: body.paymentId,
        });

        return json({
          ok: true,
          ...result,
          lifecycle: {
            payment: 'REJECTED',
            splitPayment: body.paymentId ? 'REJECTED_NOT_EXECUTED' : 'NOT_EXECUTED',
          },
          correlationId: headers.correlationId,
        }, result.replayed ? 200 : 201, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'PAYMENT_REJECTION_SIMULATION_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/payment-rejections/simulations') {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const operationId = url.searchParams.get('operationId') ?? undefined;
        const limit = Number(url.searchParams.get('limit') ?? '20');
        return json({
          ok: true,
          simulations: await listPaymentRejectionSimulations(env.DB, headers.tenantId, operationId, limit),
        }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'PAYMENT_REJECTION_HISTORY_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/payment-rejections/simulations/')) {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const id = decodeURIComponent(url.pathname.split('/').pop()!);
        const result = await getPaymentRejectionSimulation(env.DB, headers.tenantId, id);
        if (!result) return json({ error: 'PAYMENT_REJECTION_SIMULATION_NOT_FOUND' }, 404, request);
        return json({ ok: true, ...result }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'PAYMENT_REJECTION_LOOKUP_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/rag/search') {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const query = (url.searchParams.get('q') ?? '').trim();
        if (!query) return json({ error: 'RAG_QUERY_REQUIRED' }, 400, request);
        const topK = Number(url.searchParams.get('topK') ?? '5');
        const asOf = url.searchParams.get('asOf') ?? undefined;
        const sourceType = url.searchParams.get('sourceType') ?? undefined;
        const jurisdiction = url.searchParams.get('jurisdiction') ?? undefined;
        return json({ ok: true, ...await searchRag(env.DB, query, topK, asOf, sourceType, jurisdiction), tenantId: headers.tenantId }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'RAG_SEARCH_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/rag/changes') {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const sourceId = url.searchParams.get('sourceId');
        const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? '20'), 100));
        const query = sourceId
          ? 'SELECT id,source_id,old_document_id,new_document_id,detected_at,change_type,added_count,removed_count,impacted_areas_json,summary FROM regulatory_changes WHERE source_id=? ORDER BY detected_at DESC LIMIT ?'
          : 'SELECT id,source_id,old_document_id,new_document_id,detected_at,change_type,added_count,removed_count,impacted_areas_json,summary FROM regulatory_changes ORDER BY detected_at DESC LIMIT ?';
        const result = sourceId
          ? await env.DB.prepare(query).bind(sourceId, limit).all()
          : await env.DB.prepare(query).bind(limit).all();
        return json({ ok: true, tenantId: headers.tenantId, changes: result.results }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'RAG_CHANGES_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/simulations') {
      try {
        const headers = integrationHeaders(request);
        const body = await readJson(request) as SimulationRequest & { executionMode?: 'SCENARIO' | 'PRODUCTION'; ruleSetId?: string; ruleSetVersion?: string };
        if (!headers.idempotencyKey) return json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400, request);

        if (body.executionMode === 'PRODUCTION') {
          const operation = body.operation;
          if (!operation?.issuedAt) return json({ error: 'REFERENCE_DATE_REQUIRED' }, 400, request);
          const ruleSet = await resolvePublishedRuleSet(env, operation.issuedAt, body.ruleSetId, body.ruleSetVersion);
          if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);

          const existing = await findByIdempotency(env.DB, headers.tenantId, headers.idempotencyKey, 'SIMULATION');
          if (existing) {
            return json({
              ok: true, simulationId: existing.id, status: existing.status,
              ruleSet: { id: existing.rulesetId, version: existing.rulesetVersion },
              result: existing.result, correlationId: headers.correlationId, replayed: true,
            }, 200, request);
          }

          const result = executeSimulation({
            operation,
            rules: ruleSet.rules,
            calculationVersion: ruleSet.version,
          });

          const saved = await saveCompleted(env.DB, {
            tenantId: headers.tenantId,
            idempotencyKey: headers.idempotencyKey,
            operationId: operation.id,
            calculationVersion: result.result.calculationVersion,
            rulesetId: ruleSet.id,
            rulesetVersion: ruleSet.version,
            result: result.result,
            correlationId: headers.correlationId,
          });

          return json({
            ok: true,
            simulationId: saved?.id ?? result.simulationId,
            status: saved?.status ?? result.status,
            ruleSet: { id: ruleSet.id, version: ruleSet.version },
            result: saved?.result ?? result.result,
            correlationId: headers.correlationId,
            replayed: false,
          }, 200, request);
        }

        if (body.executionMode !== 'SCENARIO') {
          return json({ error: 'EXECUTION_MODE_REQUIRED', allowed: ['SCENARIO', 'PRODUCTION'] }, 400, request);
        }

        if (env.SIMULATION_WORKFLOW) {
          const instance = await env.SIMULATION_WORKFLOW.create({
            id: headers.idempotencyKey,
            params: {
              ...body,
              tenantId: headers.tenantId,
              correlationId: headers.correlationId,
              idempotencyKey: headers.idempotencyKey,
            },
          });
          return json({ ok: true, simulationId: instance.id, status: 'QUEUED', correlationId: headers.correlationId }, 202, request);
        }

        const result = executeSimulation(body);
        return json({ ok: true, simulationId: result.simulationId, status: result.status, result: result.result, correlationId: headers.correlationId }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SIMULATION_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/split-payments') {
      try {
        const headers = integrationHeaders(request);
        if (!headers.idempotencyKey) return json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400, request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const body = await readJson(request) as {
          paymentId: string;
          operationId: string;
          calculationVersion: string;
          grossAmount: string;
          taxes: { IBS?: string; CBS?: string };
        };
        if (!body.paymentId || !body.operationId || !body.grossAmount) {
          return json({ error: 'PAYMENT_FIELDS_REQUIRED' }, 400, request);
        }
        const result = await createSplitPayment(env.DB, {
          ...body,
          tenantId: headers.tenantId,
          correlationId: headers.correlationId,
          idempotencyKey: headers.idempotencyKey,
          taxes: body.taxes ?? {},
        });
        return json({ ok: true, ...result, correlationId: headers.correlationId }, result.replayed ? 200 : 201, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SPLIT_PAYMENT_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/split-payments/')) {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const id = url.pathname.split('/').pop()!;
        const result = await getSplitPayment(env.DB, headers.tenantId, id);
        if (!result) return json({ error: 'SPLIT_PAYMENT_NOT_FOUND' }, 404, request);
        return json({ ok: true, ...result }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SPLIT_PAYMENT_LOOKUP_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/v1/split-payments/') && url.pathname.endsWith('/settle')) {
      try {
        const headers = integrationHeaders(request);
        if (!headers.idempotencyKey) return json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400, request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const parts = url.pathname.split('/');
        const id = decodeURIComponent(parts[parts.length - 2]);
        const body = await readJson(request) as { tax?: import('@rts/domain').TaxCode; supplier?: boolean };
        if (!body.tax && !body.supplier) return json({ error: 'SETTLEMENT_TARGET_REQUIRED' }, 400, request);
        const result = await settleSplitPayment(env.DB, {
          tenantId: headers.tenantId, paymentId: id, tax: body.tax, supplier: Boolean(body.supplier),
          correlationId: headers.correlationId, idempotencyKey: headers.idempotencyKey,
        });
        if (!result) return json({ error: 'SPLIT_PAYMENT_NOT_FOUND' }, 404, request);
        return json({ ok: true, ...result, correlationId: headers.correlationId }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SPLIT_PAYMENT_SETTLEMENT_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/v1/split-payments/') && url.pathname.endsWith('/reverse')) {
      try {
        const headers = integrationHeaders(request);
        if (!headers.idempotencyKey) return json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400, request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const id = decodeURIComponent(url.pathname.split('/').pop() === 'reverse' ? url.pathname.split('/').slice(-2,-1)[0] : '');
        const result = await reverseSplitPayment(env.DB, { tenantId: headers.tenantId, paymentId: id, correlationId: headers.correlationId, idempotencyKey: headers.idempotencyKey });
        if (!result) return json({ error: 'SPLIT_PAYMENT_NOT_FOUND' }, 404, request);
        return json({ ok: true, ...result, correlationId: headers.correlationId }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SPLIT_PAYMENT_REVERSAL_FAILED' }, status, request);
      }
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/v1/split-payments/') && url.pathname.endsWith('/reconcile')) {
      try {
        const headers = integrationHeaders(request);
        if (!headers.idempotencyKey) return json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400, request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const id = decodeURIComponent(url.pathname.split('/').slice(-2,-1)[0]);
        const result = await reconcileSplitPayment(env.DB, { tenantId: headers.tenantId, paymentId: id, correlationId: headers.correlationId, idempotencyKey: headers.idempotencyKey });
        if (!result) return json({ error: 'SPLIT_PAYMENT_NOT_FOUND' }, 404, request);
        return json({ ok: true, ...result, correlationId: headers.correlationId }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 400;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SPLIT_PAYMENT_RECONCILIATION_FAILED' }, status, request);
      }
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/v1/simulations/')) {
      try {
        const headers = integrationHeaders(request);
        if (!env.DB) return json({ error: 'DATABASE_NOT_BOUND' }, 503, request);
        const id = url.pathname.split('/').pop()!;
        const record = await findById(env.DB, headers.tenantId, id);
        if (!record) return json({ error: 'SIMULATION_NOT_FOUND' }, 404, request);
        return json({ ok: true, simulation: record }, 200, request);
      } catch (error) {
        const status = Number((error as { status?: number }).status) || 500;
        return json({ ok: false, error: error instanceof Error ? error.message : 'SIMULATION_LOOKUP_FAILED' }, status, request);
      }
    }

    return json({ error: 'NOT_FOUND' }, 404, request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (!env.DB) return;
    const sources = await listFiscalSources(env);
    for (const source of sources) {
      try {
        await collectFiscalSource({ DB: env.DB, EVIDENCE_BUCKET: env.EVIDENCE_BUCKET }, source.id);
      } catch {
        // A single unavailable source must not prevent other sources from being collected.
      }
    }
    try { await collectEnabledGovernmentSources(env); } catch { /* keep scheduler resilient */ }
  },
};
