export type LegalDocumentType='TERMS'|'PRIVACY'|'CONSENT'|'CONTRACT'|'DATA_REQUEST'|'INCIDENT';
export type LegalStatus='DRAFT'|'ACTIVE'|'REVOKED'|'CLOSED';
export interface LegalDocument { id:string; tenantId:string; type:LegalDocumentType; version:string; status:LegalStatus; effectiveAt:string; contentHash:string; }
export interface DataSubjectRequest { id:string; tenantId:string; subjectReference:string; type:'ACCESS'|'CORRECTION'|'DELETION'|'PORTABILITY'|'OPPOSITION'; status:'RECEIVED'|'IN_REVIEW'|'FULFILLED'|'DENIED'; receivedAt:string; closedAt?:string; }