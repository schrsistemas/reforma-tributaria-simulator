export type LgpdRole='CONTROLLER'|'PROCESSOR'|'JOINT_CONTROLLER';
export type LegalBasis='CONSENT'|'CONTRACT'|'LEGAL_OBLIGATION'|'EXERCISE_OF_RIGHTS'|'LEGITIMATE_INTEREST'|'PUBLIC_POLICY'|'CREDIT_PROTECTION';
export interface DataProcessingRecord { id:string; tenantId:string; purpose:string; dataCategory:string; role:LgpdRole; legalBasis:LegalBasis; retentionDays:number; processor?:string; }
export interface ConsentRecord { id:string; tenantId:string; subjectReference:string; purpose:string; version:string; granted:boolean; recordedAt:string; revokedAt?:string; }