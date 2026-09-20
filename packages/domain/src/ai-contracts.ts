export type EvidenceLevel='PRIMARY'|'SECONDARY'|'UNVERIFIED';
export interface FiscalEvidence { documentId:string; chunkId:string; authority:string; url:string; publishedAt?:string; effectiveFrom?:string; effectiveTo?:string; version:string; contentHash:string; evidenceLevel:EvidenceLevel; }
export interface RagQuery { query:string; jurisdiction?:string; asOf?:string; topics?:string[]; limit?:number; }
export interface RagHit { chunkId:string; documentId:string; score:number; text:string; evidence:FiscalEvidence; }
export interface RulesetResolution { rulesetId:string; version:string; resolvedAt:string; evidence:FiscalEvidence[]; }
export interface FiscalCalculateInput { operationId:string; rulesetId:string; payload:Record<string,unknown>; correlationId:string; }
export interface FiscalCalculateOutput { snapshotId:string; rulesetId:string; result:Record<string,unknown>; evidence:FiscalEvidence[]; correlationId:string; }
export interface McpToolAudit { toolName:string; requestId:string; correlationId:string; startedAt:string; finishedAt?:string; outcome:'SUCCESS'|'ERROR'|'DENIED'; }
export interface LlmAnswerContract { answer:string; grounded:boolean; evidence:FiscalEvidence[]; rulesetId?:string; snapshotId?:string; warnings:string[]; }

export const MCP_FISCAL_TOOLS=[
 'fiscal.search_evidence',
 'fiscal.get_document',
 'fiscal.resolve_ruleset',
 'fiscal.calculate',
 'fiscal.compare_calculation',
 'fiscal.get_split_payment_rules',
 'fiscal.get_snapshot'
] as const;

export function assertGrounded(answer:LlmAnswerContract):void {
 if(answer.grounded && answer.evidence.length===0) throw new Error('Resposta marcada como fundamentada sem evidência.');
 if(answer.snapshotId && !answer.rulesetId) throw new Error('Snapshot exige RuleSet associado.');
}