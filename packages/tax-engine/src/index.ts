import type { FiscalOperation, RoundingMode, TaxResult, TaxRule } from '@rts/domain';

type Scaled={value:bigint;scale:number};

function parseDecimal(input:string):Scaled{
  const normalized=input.trim().replace(',','.');
  if(!/^-?\d+(\.\d+)?$/.test(normalized)) throw new Error(`Invalid decimal: ${input}`);
  const negative=normalized.startsWith('-');
  const unsigned=negative?normalized.slice(1):normalized;
  const [whole,fraction='']=unsigned.split('.');
  return {value:(negative?-1n:1n)*(BigInt(whole)*10n**BigInt(fraction.length)+BigInt(fraction||'0')),scale:fraction.length};
}
function rescale(a:Scaled,scale:number):bigint{
  if(a.scale===scale)return a.value;
  if(a.scale<scale)return a.value*10n**BigInt(scale-a.scale);
  const divisor=10n**BigInt(a.scale-scale);
  return a.value/divisor;
}
function roundScaled(value:bigint,scale:number,target:number,mode:RoundingMode):bigint{
  if(scale<=target)return value*10n**BigInt(target-scale);
  const divisor=10n**BigInt(scale-target);
  const sign=value<0n?-1n:1n; const abs=value<0n?-value:value;
  const q=abs/divisor; const r=abs%divisor;
  let up=false;
  if(mode==='UP') up=r!==0n;
  else if(mode==='HALF_UP') up=r*2n>=divisor;
  else if(mode==='HALF_EVEN') up=r*2n>divisor||(r*2n===divisor&&q%2n===1n);
  return sign*(q+(up?1n:0n));
}
function format(value:bigint,scale:number):string{
  const sign=value<0n?'-':''; const abs=value<0n?-value:value; const base=10n**BigInt(scale);
  return `${sign}${abs/base}.${(abs%base).toString().padStart(scale,'0')}`;
}
function multiply(a:Scaled,b:Scaled):Scaled{return {value:a.value*b.value,scale:a.scale+b.scale};}
function money(input:Scaled,policy:{scale:number;mode:RoundingMode}):string{
  return format(roundScaled(input.value,input.scale,policy.scale,policy.mode),policy.scale);
}

export function calculateTax(operation:FiscalOperation,rules:TaxRule[],calculationVersion='0.2.0'):TaxResult{
  const defaultPolicy={scale:2 as const,mode:'HALF_UP' as const};
  const lineValues=operation.items.map(item=>multiply(parseDecimal(item.quantity),parseDecimal(item.unitPrice)));
  const baseScale=Math.max(2,...lineValues.map(v=>v.scale));
  const baseRaw=lineValues.reduce((sum,v)=>sum+rescale(v,v.scale),0n);
  const base=money({value:lineValues.reduce((sum,v)=>sum+v.value*10n**BigInt(baseScale-v.scale),0n),scale:baseScale},defaultPolicy);
  const taxes={IBS:{base,ratePercent:'0.00',amount:'0.00'},CBS:{base,ratePercent:'0.00',amount:'0.00'}} as TaxResult['taxes'];
  const ruleTrace:TaxResult['ruleTrace']=[];
  let total=0n;
  let resultPolicy=defaultPolicy;
  for(const tax of ['IBS','CBS'] as const){
    const rule=rules.find(r=>r.tax===tax&&r.validFrom<=operation.issuedAt&&(!r.validTo||operation.issuedAt<=r.validTo));
    if(!rule)continue;
    const policy=rule.rounding??defaultPolicy; resultPolicy=policy;
    const rate=parseDecimal(rule.ratePercent);
    const baseDecimal=parseDecimal(base);
    const raw=multiply(baseDecimal,rate);
    const amount=money({value:raw.value,scale:raw.scale+2},policy);
    taxes[tax]={base,ratePercent:rule.ratePercent,amount};
    total+=rescale(parseDecimal(amount),2);
    ruleTrace.push({ruleId:rule.id,tax,source:rule.source,version:rule.version});
  }
  return {operationId:operation.id,calculationVersion,taxes,totalTax:format(total,2),taxableBase:base,ruleTrace,roundingPolicy:resultPolicy};
}
