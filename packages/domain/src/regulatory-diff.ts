export type RegulatoryChangeStatus='DETECTED'|'ASSESSED'|'CANDIDATE'|'VALIDATING'|'APPROVED'|'PUBLISHED'|'REJECTED';
export interface RegulatoryChange { id:string; sourceId:string; documentId:string; detectedAt:string; effectiveFrom?:string; effectiveTo?:string; oldHash?:string; newHash:string; status:RegulatoryChangeStatus; impactedAreas:string[]; evidenceLocation?:string; }
export interface ImpactAssessment { changeId:string; modules:string[]; severity:'LOW'|'MEDIUM'|'HIGH'; rationale:string; assessedAt:string; assessedBy:string; }
export interface RuleCandidate { id:string; changeId:string; ruleSetId:string; status:'DRAFT'|'VALIDATING'|'APPROVED'|'REJECTED'; evidence:string[]; createdAt:string; }
export interface RulePublication { candidateId:string; ruleSetId:string; publishedAt:string; publishedBy:string; evidence:string[]; }

export interface ChangeSegment { kind:'ADDED'|'REMOVED'|'UNCHANGED'; text:string; }
export interface DocumentDiff { oldHash:string; newHash:string; changed:boolean; added:number; removed:number; segments:ChangeSegment[]; }
export function diffLines(oldText:string,newText:string):DocumentDiff {
 const a=oldText.split(/\\r?\\n/),b=newText.split(/\\r?\\n/),segments:ChangeSegment[]=[];
 const oldSet=new Set(a),newSet=new Set(b); let added=0,removed=0;
 for(const line of b){if(!oldSet.has(line)){segments.push({kind:'ADDED',text:line});added++;}}
 for(const line of a){if(!newSet.has(line)){segments.push({kind:'REMOVED',text:line});removed++;}}
 return {oldHash:'',newHash:'',changed:added>0||removed>0,added,removed,segments};
}
export function impactedAreas(text:string){
 const t=text.toLowerCase(); const areas:string[]=[];
 const rules:[string,string[]][]=[['REFORMA_TRIBUTARIA',['ibs','cbs','reforma tributaria','split payment']],['MEI',['mei','microempreendedor']],['SIMPLES',['simples nacional']],['DOCUMENTOS_FISCAIS',['nf-e','nfe','nfse','documento fiscal','leiaute']],['PAGAMENTOS',['pix','tef','cartao','cartão','pagamento']],['LGPD',['lgpd','dados pessoais','anpd']],['JURIDICO',['contrato','termo','obrigacao','obrigação']]];
 for(const [area,terms] of rules)if(terms.some(x=>t.includes(x)))areas.push(area);
 return areas;
}