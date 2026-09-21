export type CreditTax='IBS'|'CBS';
export type CreditEligibility='ELIGIBLE'|'INELIGIBLE'|'CONDITIONAL';
export type CreditReason=
  | 'REGULAR_ACQUISITION'
  | 'PERSONAL_CONSUMPTION'
  | 'DOCUMENT_REQUIRED'
  | 'EXTINCTION_REQUIRED'
  | 'FISCAL_REGIME_EXCEPTION'
  | 'INSUFFICIENT_FACTS'
  | 'CONTEXT_SPECIFIC';

export type CreditAcquisitionCategory=
  | 'GOODS'
  | 'RAW_MATERIALS'
  | 'MACHINERY'
  | 'SOFTWARE_TECHNOLOGY'
  | 'ENERGY'
  | 'FREIGHT_LOGISTICS'
  | 'CONTRACTED_SERVICES'
  | 'COMMERCIAL_RENTAL'
  | 'VEHICLE'
  | 'FUEL'
  | 'FOOD'
  | 'TRAVEL_HOSPITALITY'
  | 'TELECOM'
  | 'GIFT'
  | 'JEWELRY'
  | 'ART_ANTIQUES'
  | 'ALCOHOL'
  | 'TOBACCO'
  | 'WEAPONS_AMMUNITION'
  | 'RECREATIONAL_SPORTS_AESTHETIC'
  | 'OTHER';

export interface CreditEligibilityInput {
  category: CreditAcquisitionCategory;
  regularTaxpayer: boolean;
  electronicFiscalDocument: boolean;
  taxDebtExtinguished: boolean;
  suppliedFreeOrBelowMarketToPerson?: boolean;
  economicActivityRelated?: boolean;
  fuelSpecificRegime?: boolean;
  relatedToPersonalConsumptionItem?: boolean;
  operationalPurpose?: 'BUSINESS'|'PERSONAL'|'MIXED'|'UNKNOWN';
}

export interface CreditTaxDecision {
  tax: CreditTax;
  eligibility: CreditEligibility;
  reason: CreditReason;
  legalBasis: string[];
  ruleId: string;
}

export interface CreditEligibilityResult {
  ibs: CreditTaxDecision;
  cbs: CreditTaxDecision;
  personalConsumption: boolean;
  warnings: string[];
  source: {
    authority: 'PLANALTO';
    law: 'LC 214/2025';
    currentCompilation: boolean;
    url: string;
  };
}

const OFFICIAL_URL='https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm';
const PERSONAL_CATEGORIES=new Set<CreditAcquisitionCategory>([
  'JEWELRY','ART_ANTIQUES','ALCOHOL','TOBACCO','WEAPONS_AMMUNITION','RECREATIONAL_SPORTS_AESTHETIC'
]);
const CONTEXT_CATEGORIES=new Set<CreditAcquisitionCategory>([
  'VEHICLE','FOOD','TRAVEL_HOSPITALITY','TELECOM','GIFT','FUEL'
]);

export const CREDIT_ELIGIBILITY_RULE_MATRIX = [
  {ruleId:'CE-057-I', categories:['JEWELRY','ART_ANTIQUES','ALCOHOL','TOBACCO','WEAPONS_AMMUNITION','RECREATIONAL_SPORTS_AESTHETIC'], outcome:'INELIGIBLE', basis:'LC 214/2025, art. 57, I'},
  {ruleId:'CE-057-II', categories:['OTHER'], outcome:'INELIGIBLE', basis:'LC 214/2025, art. 57, II'},
  {ruleId:'CE-047-DOC', categories:['OTHER'], outcome:'CONDITIONAL', basis:'LC 214/2025, art. 47, §1º, II'},
  {ruleId:'CE-047-FUEL', categories:['FUEL'], outcome:'CONDITIONAL', basis:'LC 214/2025, art. 47, §§4º e 5º'},
  {ruleId:'CE-CONTEXT', categories:['VEHICLE','FOOD','TRAVEL_HOSPITALITY','TELECOM','GIFT','FUEL'], outcome:'CONDITIONAL', basis:'Requer fatos adicionais e verificação de regime/exceções'},
] as const;

function decision(input:CreditEligibilityInput,tax:CreditTax):CreditTaxDecision {
  const legal47='LC 214/2025, art. 47';
  const legal57='LC 214/2025, art. 57';

  if(PERSONAL_CATEGORIES.has(input.category)) {
    return {tax,eligibility:'INELIGIBLE',reason:'PERSONAL_CONSUMPTION',legalBasis:[legal57+' (inciso I)'],ruleId:'CE-057-I'};
  }
  if(input.suppliedFreeOrBelowMarketToPerson || input.relatedToPersonalConsumptionItem) {
    return {tax,eligibility:'INELIGIBLE',reason:'PERSONAL_CONSUMPTION',legalBasis:[legal57+' (inciso II)'],ruleId:'CE-057-II'};
  }
  if(!input.regularTaxpayer) {
    return {tax,eligibility:'CONDITIONAL',reason:'FISCAL_REGIME_EXCEPTION',legalBasis:['LC 214/2025, art. 47; verificar regime aplicável'],ruleId:'CE-REGIME'};
  }
  if(!input.electronicFiscalDocument) {
    return {tax,eligibility:'CONDITIONAL',reason:'DOCUMENT_REQUIRED',legalBasis:[legal47+' (§1º, II)'],ruleId:'CE-047-DOC'};
  }
  if(input.fuelSpecificRegime || input.category==='FUEL') {
    if(input.fuelSpecificRegime) {
      return {tax,eligibility:'ELIGIBLE',reason:'REGULAR_ACQUISITION',legalBasis:[legal47+' (§§4º e 5º)'],ruleId:'CE-047-FUEL'};
    }
    return {tax,eligibility:'CONDITIONAL',reason:'FISCAL_REGIME_EXCEPTION',legalBasis:[legal47+'; combustível possui regime específico'],ruleId:'CE-047-FUEL'};
  }
  if(!input.taxDebtExtinguished) {
    return {tax,eligibility:'CONDITIONAL',reason:'EXTINCTION_REQUIRED',legalBasis:[legal47, 'LC 214/2025, art. 48'],ruleId:'CE-047-EXTINCTION'};
  }
  if(input.economicActivityRelated!==true) {
    return {tax,eligibility:'CONDITIONAL',reason:'INSUFFICIENT_FACTS',legalBasis:[legal47,legal57],ruleId:'CE-CONTEXT'};
  }
  return {tax,eligibility:'ELIGIBLE',reason:'REGULAR_ACQUISITION',legalBasis:[legal47],ruleId:'CE-047-GENERAL'};
}

export function evaluateCreditEligibility(input:CreditEligibilityInput):CreditEligibilityResult {
  const personal=PERSONAL_CATEGORIES.has(input.category)||Boolean(input.suppliedFreeOrBelowMarketToPerson)||Boolean(input.relatedToPersonalConsumptionItem);
  const warnings:string[]=[];
  if(input.category==='OTHER') warnings.push('Categoria genérica: classificar a aquisição antes de tratar o resultado como definitivo.');
  if(input.economicActivityRelated===undefined) warnings.push('A relação com a atividade econômica não foi informada.');
  if(input.operationalPurpose===undefined || input.operationalPurpose==='UNKNOWN') warnings.push('A finalidade da aquisição não foi informada.');
  if(CONTEXT_CATEGORIES.has(input.category)) warnings.push('Esta categoria exige análise contextual; não tratar a classificação como crédito automático.');
  return {
    ibs:decision(input,'IBS'),
    cbs:decision(input,'CBS'),
    personalConsumption:personal,
    warnings,
    source:{authority:'PLANALTO',law:'LC 214/2025',currentCompilation:true,url:OFFICIAL_URL},
  };
}
