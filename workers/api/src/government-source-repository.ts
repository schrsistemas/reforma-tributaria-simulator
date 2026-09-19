import type { GovernmentSource, JurisdictionLevel, CollectorType, GovernmentDocumentType } from '@rts/domain';

interface Env { DB?: D1Database; }
interface Row {
  id:string; authority_id:string; name:string; source_type:string; document_types:string;
  collector_type:CollectorType; official_url:string; discovery_url:string|null;
  api_url:string|null; rss_url:string|null; cadence:string; priority:number;
  enabled:number; health_status:string;
}

function map(row:Row):GovernmentSource {
  return {
    id:row.id, authorityId:row.authority_id, name:row.name, sourceType:row.source_type,
    documentTypes:row.document_types.split(',').filter(Boolean) as GovernmentDocumentType[],
    collectorType:row.collector_type, officialUrl:row.official_url,
    discoveryUrl:row.discovery_url ?? undefined, apiUrl:row.api_url ?? undefined,
    rssUrl:row.rss_url ?? undefined, cadence:row.cadence, priority:row.priority,
    enabled:row.enabled===1,
    healthStatus:(row.health_status as GovernmentSource['healthStatus']) || 'UNKNOWN',
  };
}

export async function listGovernmentSources(env:Env, scope?:{jurisdictionLevel?:JurisdictionLevel;stateCode?:string}):Promise<GovernmentSource[]> {
  if(!env.DB) throw Object.assign(new Error('DATABASE_NOT_BOUND'),{status:503});
  const clauses=['s.enabled=1']; const args:(string|number)[]=[];
  if(scope?.jurisdictionLevel){clauses.push('a.jurisdiction_level=?');args.push(scope.jurisdictionLevel);}
  if(scope?.stateCode){clauses.push('a.state_code=?');args.push(scope.stateCode);}
  const sql=`SELECT s.id,s.authority_id,s.name,s.source_type,s.document_types,s.collector_type,s.official_url,s.discovery_url,s.api_url,s.rss_url,s.cadence,s.priority,s.enabled,s.health_status
    FROM government_sources s JOIN government_authorities a ON a.id=s.authority_id
    WHERE ${clauses.join(' AND ')} ORDER BY s.priority DESC,s.name`;
  const rows=await env.DB.prepare(sql).bind(...args).all<Row>();
  return rows.results.map(map);
}
