import type { RuleSet } from '@rts/domain';

export interface CatalogEnv { DB?: D1Database }
type RuleSetRow={id:string;version:string;effective_from:string;effective_to:string|null;source_set_json:string;status:RuleSet['status']};

export async function resolvePublishedRuleSet(env:CatalogEnv, referenceDate:string, id?:string, version?:string):Promise<RuleSet>{
  if(!env.DB) throw Object.assign(new Error('RULE_CATALOG_NOT_BOUND'),{status:503});
  const clauses=['status = ?','effective_from <= ?','(effective_to IS NULL OR effective_to >= ?)'];
  const params:unknown[]=['PUBLISHED',referenceDate,referenceDate];
  if(id){clauses.push('id = ?');params.push(id);}
  if(version){clauses.push('version = ?');params.push(version);}
  const sql='SELECT id,version,effective_from,effective_to,source_set_json,status FROM rule_sets WHERE '+clauses.join(' AND ')+' ORDER BY version DESC';
  const rows=await env.DB.prepare(sql).bind(...params).all<RuleSetRow>();
  if(rows.results.length===0) throw Object.assign(new Error('NO_PUBLISHED_RULESET'),{status:422});
  if(rows.results.length>1 && (!id || !version)) throw Object.assign(new Error('AMBIGUOUS_PUBLISHED_RULESET'),{status:409});
  const row=rows.results[0];
  const ruleRows=await env.DB.prepare('SELECT id,tax,valid_from,valid_to,rate_percent,source,version FROM tax_rules WHERE ruleset_id = ? AND ruleset_version = ? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)').bind(row.id,row.version,referenceDate,referenceDate).all();
  return {id:row.id,version:row.version,effectiveFrom:row.effective_from,effectiveTo:row.effective_to??undefined,sourceSet:JSON.parse(row.source_set_json) as string[],status:row.status,rules:ruleRows.results.map((r:any)=>({id:r.id,tax:r.tax,validFrom:r.valid_from,validTo:r.valid_to??undefined,ratePercent:r.rate_percent,source:r.source,version:r.version}))};
}