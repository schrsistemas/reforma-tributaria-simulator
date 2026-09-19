export type RagSourceType='LAW'|'REGULATION'|'GUIDANCE'|'NEWS'|'TECHNICAL_NOTE'|'FAQ';
export interface RagDocument { id:string; sourceId:string; title:string; jurisdiction:string; publishedAt:string; effectiveFrom?:string; effectiveTo?:string; sourceUrl:string; contentHash:string; version:string; }
export interface RagChunk { id:string; documentId:string; ordinal:number; text:string; tokenCount:number; embeddingRef?:string; metadata:Record<string,string>; }
export interface RagQuery { tenantId:string; query:string; jurisdiction?:string; asOf?:string; topK?:number; }
export interface RagHit { chunkId:string; documentId:string; score:number; text:string; sourceUrl:string; title:string; }
export interface RagAnswer { answer:string; hits:RagHit[]; confidence:'LOW'|'MEDIUM'|'HIGH'; grounded:true; generatedAt:string; }
export const RAG_GUARDRAILS=['answer only from retrieved evidence','preserve effective-date context','cite source document','never treat model output as a RuleSet','flag insufficient evidence'] as const;