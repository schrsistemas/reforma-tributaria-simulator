export type CreditTax='IBS'|'CBS';
export type CreditEligibility='ELIGIBLE'|'INELIGIBLE'|'CONDITIONAL';
export type CreditReason=
  | 'REGULAR_ACQUISITION'
  | 'PERSONAL_CONSUMPTION'
  | 'DOCUMENT_REQUIRED'
  | 'EXTINCTION_REQUIRED'
  | 'FISCAL_REGIME_EXCEPTION'
  | 'INSUFFICIENT_FACTS';

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
}

export interface CreditTaxDecision {
  tax: CreditTax;
  eligibility: CreditEligibility;
  reason: CreditReason;
  legalBasis: string[];
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

function decision(input:CreditEligibilityInput,tax:CreditTax):CreditTaxDecision {
  const legal47='LC 214/2025, art. 47';
  const legal57='LC 214/2025, art. 57';

  if(PERSONAL_CATEGORIES.has(input.category)) {
    return {tax,eligibility:'INELIGIBLE',reason:'PERSONAL_CONSUMPTION',legalBasis:[legal57+' (inciso I)']};
  }
  if(input.suppliedFreeOrBelowMarketToPerson) {
    return {tax,eligibility:'INELIGIBLE',reason:'PERSONAL_CONSUMPTION',legalBasis:[legal57+' (inciso II)']};
  }
  if(!input.regularTaxpayer) {
    return {tax,eligibility:'INELIGIBLE',reason:'FISCAL_REGIME_EXCEPTION',legalBasis:['LC 214/2025, art. 47; verificar regime aplicável']};
  }
  if(!input.electronicFiscalDocument) {
    return {tax,eligibility:'CONDITIONAL',reason:'DOCUMENT_REQUIRED',legalBasis:[legal47+' (§1º, II)']};
  }
  if(input.fuelSpecificRegime || input.category==='FUEL') {
    if(input.fuelSpecificRegime) {
      return {tax,eligibility:'ELIGIBLE',reason:'REGULAR_ACQUISITION',legalBasis:[legal47+' (§§4º e 5º)']};
    }
    return {tax,eligibility:'CONDITIONAL',reason:'FISCAL_REGIME_EXCEPTION',legalBasis:[legal47+'; combustível possui regime específico']};
  }
  if(!input.taxDebtExtinguished) {
    return {tax,eligibility:'CONDITIONAL',reason:'EXTINCTION_REQUIRED',legalBasis:[legal47, 'LC 214/2025, art. 48']};
  }
  if(input.economicActivityRelated===false) {
    return {tax,eligibility:'CONDITIONAL',reason:'INSUFFICIENT_FACTS',legalBasis:[legal47,legal57]};
  }
  return {tax,eligibility:'ELIGIBLE',reason:'REGULAR_ACQUISITION',legalBasis:[legal47]};
}

export function evaluateCreditEligibility(input:CreditEligibilityInput):CreditEligibilityResult {
  const personal=PERSONAL_CATEGORIES.has(input.category)||Boolean(input.suppliedFreeOrBelowMarketToPerson);
  const warnings:string[]=[];
  if(input.category==='OTHER') warnings.push('Categoria genérica: classificar a aquisição antes de tratar o resultado como definitivo.');
  if(input.economicActivityRelated===undefined) warnings.push('A relação com a atividade econômica não foi informada.');
  return {
    ibs:decision(input,'IBS'),
    cbs:decision(input,'CBS'),
    personalConsumption:personal,
    warnings,
    source:{authority:'PLANALTO',law:'LC 214/2025',currentCompilation:true,url:OFFICIAL_URL},
  };
}
