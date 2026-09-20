import type { RagAnswer, RagHit, FiscalEvidence } from '@rts/domain';
import { lexicalScore, rerank, temporalMatch, type RagCandidate } from '@rts/domain';

export async function searchRag(db:D1Database,query:string,topK=5,asOf?:string):Promise<RagAnswer>{
 const rows=await db.prepare('SELECT c.id chunk_id,c.document_id,c.text,d.title,d.source_url,d.published_at,d.effective_from,d.effective_to,d.version,d.content_hash,s.authority FROM rag_chunks c JOIN rag_documents d ON d.id=c.document_id LEFT JOIN fiscal_sources s ON s.id=d.source_id ORDER BY d.published_at DESC LIMIT 1000').all<Record<string,unknown>>();
 const candidates:RagCandidate[]=rows.results.map(r=>({id:String(r.chunk_id),documentId:String(r.document_id),text:String(r.text),score:lexicalScore(query,String(r.text)),sourceUrl:String(r.source_url),title:String(r.title),publishedAt:String(r.published_at??''),effectiveFrom:r.effective_from?String(r.effective_from):undefined,effectiveTo:r.effective_to?String(r.effective_to):undefined,authority:r.authority?String(r.authority):undefined})).filter(c=>c.score>0&&temporalMatch(c,asOf));
 const ranked=rerank(query,candidates).slice(0,Math.max(1,Math.min(topK,10)));
 const hits:RagHit[]=ranked.map(x=>({chunkId:x.id,documentId:x.documentId,score:x.score,text:x.text,evidence:{documentId:x.documentId,chunkId:x.id,authority:String((rows.results.find(r=>String(r.chunk_id)===x.id) as Record<string,unknown>)?.authority??'UNKNOWN'),url:x.sourceUrl,publishedAt:x.publishedAt,effectiveFrom:x.effectiveFrom,effectiveTo:x.effectiveTo,version:String((rows.results.find(r=>String(r.chunk_id)===x.id) as Record<string,unknown>)?.version??'UNKNOWN'),contentHash:String((rows.results.find(r=>String(r.chunk_id)===x.id) as Record<string,unknown>)?.content_hash??'UNKNOWN'),evidenceLevel:'PRIMARY'} as FiscalEvidence}}));
 const confidence=hits.length===0?'LOW':hits[0].score>=.65?'HIGH':hits[0].score>=.3?'MEDIUM':'LOW';
 const answer=hits.length?'Evidências recuperadas para: "'+query+'". A resposta deve ser construída exclusivamente a partir das fontes recuperadas e respeitar a vigência indicada.':'Não há evidência suficiente no índice RAG para responder com segurança.';
 return {answer,hits,confidence,grounded:true,generatedAt:new Date().toISOString()};
}

export async function getRagDocument(db:D1Database,documentId:string){
 const row=await db.prepare('SELECT id,title,source_url,published_at,effective_from,effective_to,version,content_hash,source_id FROM rag_documents WHERE id=?').bind(documentId).first<Record<string,unknown>>();
 if(!row)return null;
 const chunks=await db.prepare('SELECT id,ordinal,text FROM rag_chunks WHERE document_id=? ORDER BY ordinal').bind(documentId).all<Record<string,unknown>>();
 return {documentId:String(row.id),title:String(row.title),sourceUrl:String(row.source_url),publishedAt:String(row.published_at??''),effectiveFrom:row.effective_from?String(row.effective_from):undefined,effectiveTo:row.effective_to?String(row.effective_to):undefined,version:String(row.version),contentHash:String(row.content_hash),sourceId:String(row.source_id),chunks:chunks.results.map(x=>({chunkId:String(x.id),ordinal:Number(x.ordinal),text:String(x.text)}))};
}
