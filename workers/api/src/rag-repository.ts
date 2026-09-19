import type { RagAnswer, RagHit } from '@rts/domain';

function score(query:string,text:string){const q=new Set(query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\W+/).filter(Boolean));const words=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\W+/).filter(Boolean);let hits=0;for(const w of q)if(words.includes(w))hits++;return q.size?hits/q.size:0;}
export async function searchRag(db:D1Database,query:string,topK=5,asOf?:string):Promise<RagAnswer>{
 const rows=await db.prepare('SELECT c.id chunk_id,c.document_id,c.text,d.title,d.source_url FROM rag_chunks c JOIN rag_documents d ON d.id=c.document_id ORDER BY d.published_at DESC LIMIT 500').all<Record<string,unknown>>();
 const hits:RagHit[]=rows.results.map(r=>({chunkId:String(r.chunk_id),documentId:String(r.document_id),score:score(query,String(r.text)),text:String(r.text),sourceUrl:String(r.source_url),title:String(r.title)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(topK,10)));
 const confidence=hits.length===0?'LOW':hits[0].score>=.5?'HIGH':hits[0].score>=.25?'MEDIUM':'LOW';
 const answer=hits.length?'Evidências recuperadas para: "'+query+'". A resposta deve ser construída exclusivamente a partir das fontes recuperadas e respeitar a vigência indicada.':'Não há evidência suficiente no índice RAG para responder com segurança.';
 return {answer,hits,confidence,grounded:true,generatedAt:new Date().toISOString()};
}
