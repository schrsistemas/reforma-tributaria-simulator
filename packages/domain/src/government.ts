export type JurisdictionLevel = 'FEDERAL' | 'STATE' | 'MUNICIPAL';

export type GovernmentDocumentType =
  | 'CONSTITUTIONAL_AMENDMENT' | 'LAW' | 'COMPLEMENTARY_LAW' | 'DECREE'
  | 'RESOLUTION' | 'ORDINANCE' | 'NORMATIVE_INSTRUCTION' | 'TECHNICAL_NOTE'
  | 'MANUAL' | 'SCHEMA' | 'GUIDANCE' | 'OFFICIAL_NOTICE' | 'ACT' | 'OTHER';

export type CollectorType =
  | 'REST_API' | 'HTTP_JSON' | 'HTTP_XML' | 'HTML' | 'PDF' | 'RSS'
  | 'DOU' | 'DOM' | 'SITEMAP' | 'FILE';

export interface GovernmentAuthority {
  id:string; countryCode:string; jurisdictionLevel:JurisdictionLevel;
  stateCode?:string; municipalityCode?:string; name:string;
  authorityType:string; officialDomain?:string; enabled:boolean;
}

export interface GovernmentSource {
  id:string; authorityId:string; name:string; sourceType:string;
  documentTypes:GovernmentDocumentType[]; collectorType:CollectorType;
  officialUrl:string; discoveryUrl?:string; apiUrl?:string; rssUrl?:string;
  cadence:string; priority:number; enabled:boolean;
  healthStatus:'UNKNOWN'|'HEALTHY'|'DEGRADED'|'FAILED';
}

export interface RegulatoryDocument {
  id:string; sourceId:string; authorityId:string; jurisdictionLevel:JurisdictionLevel;
  stateCode?:string; municipalityCode?:string; documentType:GovernmentDocumentType;
  officialIdentifier?:string; title:string; summary?:string; publicationDate?:string;
  effectiveDate?:string; expirationDate?:string; status:string; officialUrl:string;
  contentLocation:string; contentHash:string; normalizedHash:string; retrievedAt:string;
  supersedesDocumentId?:string; amendsDocumentId?:string; revokesDocumentId?:string;
}

export interface CollectorResult {
  sourceId:string; fetchedAt:string; httpStatus?:number; contentType?:string;
  contentHash:string; normalizedHash:string; title?:string;
  officialIdentifier?:string; publicationDate?:string; contentLocation:string;
}
