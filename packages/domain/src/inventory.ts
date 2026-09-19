export type StockMovementType='IN'|'OUT'|'TRANSFER'|'ADJUSTMENT'|'RETURN';
export interface InventoryItem { id:string; tenantId:string; sku:string; barcode?:string; description:string; ncm?:string; unit:string; quantity:string; averageCostMinor:number; location?:string; }
export interface StockMovement { id:string; itemId:string; type:StockMovementType; quantity:string; unitCostMinor?:number; documentId?:string; operationId?:string; occurredAt:string; }
export type FiscalDocumentType='NFE'|'NFCE'|'NFSE'|'CTE'|'MDFE'|'NFCOM'|'OTHER';
export interface FiscalDocument { id:string; tenantId:string; type:FiscalDocumentType; accessKey?:string; number?:string; series?:string; issuerDocument:string; recipientDocument?:string; issuedAt:string; totalMinor:number; status:'AUTHORIZED'|'CANCELLED'|'DENIED'|'CONTINGENCY'|'DRAFT'; xmlHash?:string; xmlLocation?:string; }
export interface FiscalFile { id:string; tenantId:string; kind:'SPED'|'EFD_ICMS_IPI'|'EFD_CONTRIBUICOES'|'ECD'|'ECF'|'XML'|'DANFE'|'OTHER'; period:string; fileName:string; contentHash:string; status:'RECEIVED'|'VALIDATED'|'REJECTED'|'PROCESSED'; }
export interface AccountingEntry { id:string; tenantId:string; documentId?:string; accountDebit:string; accountCredit:string; amountMinor:number; competence:string; description:string; source:'FISCAL_DOCUMENT'|'PAYMENT'|'STOCK'|'MANUAL'; }
