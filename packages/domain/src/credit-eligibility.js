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

export type CreditDocumentType='NFE'|'NFSE'|'CTE'|'CTE_OS'|'NFC_E'|'OTHER_ELECTRONIC';
export type CreditOperationTaxTreatment='NORMAL'|'IMMUNE'|'EXEMPT'|'ZERO_RATE'|'DEFERRAL'|'SUSPENSION'|'OTHER';

export interface CreditEligibilityInput {
  category: CreditAcquisitionCategory;
  regularTaxpayer: boolean;
  electronicFiscalDocument: boolean;
  taxDebtExtinguished: boolean;

  /** Optional art. 48 exception when the relevant extinction modalities were not implemented. */
  extinctionRequirementWaived?: boolean;

  suppliedFreeOrBelowMarketToPerson?: boolean;
  economicActivityRelated?: boolean;
  fuelSpecificRegime?: boolean;
  relatedToPersonalConsumptionItem?: boolean;
  operationalPurpose?: 'BUSINESS'|'PERSONAL'|'MIXED'|'UNKNOWN';

  /** Evidence/context used to apply the art. 57 §3 exceptions. */
  commercializedOrUsedForManufacturing?: boolean;
  usedBySecurityCompany?: boolean;
  usedExclusivelyByCustomersOnPremises?: boolean;
  serviceProvidedForConsiderationToCustomers?: boolean;
  predominantActivityIsSameService?: boolean;
  workdayOnPremisesEmployeeProvision?: boolean;
  documentType?: CreditDocumentType;
  operationTaxTreatment?: CreditOperationTaxTreatment;
  ncm?: string;
  cfop?: string;
  itemDescription?: string;
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
    amendments: string[];
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

/**
 * Matrix is descriptive metadata for audit/UI. Conditions deliberately describe
 * the legal trigger instead of pretending every rule maps to one merchandise category.
 */
export const CREDIT_ELIGIBILITY_RULE_MATRIX = [
  {ruleId:'CE-057-I', outcome:'INELIGIBLE', basis:'LC 214/2025, art. 57, I', condition:'listed personal-use goods/services, subject to art. 57, §3º exceptions'},
  {ruleId:'CE-057-I-G', outcome:'INELIGIBLE', basis:'LC 214/2025, art. 57, I, g', condition:'goods/services related to acquisition or maintenance of art. 57, I items'},
  {ruleId:'CE-057-II', outcome:'INELIGIBLE', basis:'LC 214/2025, art. 57, II', condition:'non-onerous or below-market supply to the persons listed in art. 57, II'},
  {ruleId:'CE-057-VEHICLE', outcome:'INELIGIBLE', basis:'LC 214/2025, art. 57, §1º, II', condition:'vehicle and related costs acquired for the art. 57, II personal-use supply'},
  {ruleId:'CE-057-EXCEPTION', outcome:'ELIGIBLE', basis:'LC 214/2025, art. 57, §3º', condition:'preponderant economic use satisfying one of the statutory exceptions'},
  {ruleId:'CE-047-DOC', outcome:'CONDITIONAL', basis:'LC 214/2025, art. 47, §1º, II', condition:'operation lacks an idoneous electronic fiscal document'},
  {ruleId:'CE-047-EXTINCTION', outcome:'CONDITIONAL', basis:'LC 214/2025, art. 47 and art. 48', condition:'required tax-debt extinction has not occurred and no art. 48 exception was established'},
  {ruleId:'CE-047-FUEL', outcome:'CONDITIONAL', basis:'LC 214/2025, art. 47, §§4º e 5º', condition:'fuel acquired under the specific fuel regime'},
  {ruleId:'CE-049', outcome:'CONDITIONAL', basis:'LC 214/2025, art. 49', condition:'immune, exempt, zero-rate, deferral or suspension operation; verify express presumptive-credit exception'},
  {ruleId:'CE-CONTEXT', outcome:'CONDITIONAL', basis:'LC 214/2025, arts. 47 and 57', condition:'facts or classification are insufficient for a definitive determination'},
] as const;

function decision(input:CreditEligibilityInput,tax:CreditTax):CreditTaxDecision {
  const legal47='LC 214/2025, art. 47';
  const legal57='LC 214/2025, art. 57';

  const listedPersonal=input.category;
  const art57Listed=PERSONAL_CATEGORIES.has(listedPersonal);

  if(art57Listed) {
    const commercialException =
      input.commercializedOrUsedForManufacturing === true &&
      ['JEWELRY','ART_ANTIQUES','ALCOHOL','TOBACCO'].includes(listedPersonal);

    const weaponsException =
      listedPersonal==='WEAPONS_AMMUNITION' &&
      (input.commercializedOrUsedForManufacturing===true || input.usedBySecurityCompany===true);

    const recreationalException =
      listedPersonal==='RECREATIONAL_SPORTS_AESTHETIC' &&
      (input.commercializedOrUsedForManufacturing===true || input.usedExclusivelyByCustomersOnPremises===true || input.serviceProvidedForConsiderationToCustomers===true || input.predominantActivityIsSameService===true);

    if(commercialException || weaponsException || recreationalException) {
      return {
        tax,
        eligibility:'ELIGIBLE',
        reason:'REGULAR_ACQUISITION',
        legalBasis:[legal57+' (§3º)'],
        ruleId:'CE-057-EXCEPTION'
      };
    }

    return {
      tax,
      eligibility:'INELIGIBLE',
      reason:'PERSONAL_CONSUMPTION',
      legalBasis:[legal57+' (inciso I)'],
      ruleId:'CE-057-I'
    };
  }

  if(input.relatedToPersonalConsumptionItem) {
    return {
      tax,
      eligibility:'INELIGIBLE',
      reason:'PERSONAL_CONSUMPTION',
      legalBasis:[legal57+' (inciso I, alínea g)'],
      ruleId:'CE-057-I-G'
    };
  }

  if(input.suppliedFreeOrBelowMarketToPerson) {
    if(
      input.category==='FOOD' &&
      input.workdayOnPremisesEmployeeProvision===true
    ) {
      // Art. 57 §3º, IV, c: food and non-alcoholic beverage at the
      // taxpayer's establishment during the workday is excluded from personal use.
    } else if(
      input.category==='VEHICLE' ||
      input.category==='COMMERCIAL_RENTAL' ||
      input.category==='OTHER'
    ) {
      return {
        tax,
        eligibility:'INELIGIBLE',
        reason:'PERSONAL_CONSUMPTION',
        legalBasis:[legal57+' (inciso II e §1º)'],
        ruleId:input.category==='VEHICLE'?'CE-057-VEHICLE':'CE-057-II'
      };
    } else {
      return {
        tax,
        eligibility:'INELIGIBLE',
        reason:'PERSONAL_CONSUMPTION',
        legalBasis:[legal57+' (inciso II)'],
        ruleId:'CE-057-II'
      };
    }
  }

  if(!input.regularTaxpayer) {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'FISCAL_REGIME_EXCEPTION',
      legalBasis:[legal47+'; regime regular não confirmado'],
      ruleId:'CE-REGIME'
    };
  }

  if(!input.electronicFiscalDocument) {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'DOCUMENT_REQUIRED',
      legalBasis:[legal47+' (§1º, II)'],
      ruleId:'CE-047-DOC'
    };
  }

  if(input.operationTaxTreatment && input.operationTaxTreatment!=='NORMAL') {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'FISCAL_REGIME_EXCEPTION',
      legalBasis:['LC 214/2025, art. 49; verificar crédito presumido ou exceção expressa'],
      ruleId:'CE-049'
    };
  }

  if(input.category==='FUEL') {
    if(input.fuelSpecificRegime) {
      return {
        tax,
        eligibility:'ELIGIBLE',
        reason:'REGULAR_ACQUISITION',
        legalBasis:[legal47+' (§§4º e 5º)'],
        ruleId:'CE-047-FUEL'
      };
    }
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'FISCAL_REGIME_EXCEPTION',
      legalBasis:[legal47+'; combustível pode estar sujeito a regime específico'],
      ruleId:'CE-047-FUEL'
    };
  }

  if(!input.taxDebtExtinguished && !input.extinctionRequirementWaived) {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'EXTINCTION_REQUIRED',
      legalBasis:[legal47,'LC 214/2025, art. 48'],
      ruleId:'CE-047-EXTINCTION'
    };
  }

  if(input.economicActivityRelated!==true) {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'INSUFFICIENT_FACTS',
      legalBasis:[legal47,legal57+' (§3º)'],
      ruleId:'CE-CONTEXT'
    };
  }

  if(input.operationalPurpose==='PERSONAL') {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'CONTEXT_SPECIFIC',
      legalBasis:[legal57+' (§3º); confirmar uso preponderante e destinatário'],
      ruleId:'CE-CONTEXT'
    };
  }

  if(CONTEXT_CATEGORIES.has(input.category)) {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'CONTEXT_SPECIFIC',
      legalBasis:[legal47,legal57],
      ruleId:'CE-CONTEXT'
    };
  }

  if(input.operationalPurpose==='UNKNOWN' || input.operationalPurpose==='MIXED' || input.operationalPurpose===undefined) {
    return {
      tax,
      eligibility:'CONDITIONAL',
      reason:'INSUFFICIENT_FACTS',
      legalBasis:[legal47,legal57],
      ruleId:'CE-CONTEXT'
    };
  }

  return {
    tax,
    eligibility:'ELIGIBLE',
    reason:'REGULAR_ACQUISITION',
    legalBasis:[legal47],
    ruleId:'CE-047-GENERAL'
  };
}

export function evaluateCreditEligibility(input:CreditEligibilityInput):CreditEligibilityResult {
  const personal=
    PERSONAL_CATEGORIES.has(input.category) &&
    !(
      input.commercializedOrUsedForManufacturing===true &&
      ['JEWELRY','ART_ANTIQUES','ALCOHOL','TOBACCO'].includes(input.category)
    ) &&
    !(
      input.category==='WEAPONS_AMMUNITION' &&
      (input.commercializedOrUsedForManufacturing===true || input.usedBySecurityCompany===true)
    ) &&
    !(
      input.category==='RECREATIONAL_SPORTS_AESTHETIC' &&
      (input.commercializedOrUsedForManufacturing===true || input.usedExclusivelyByCustomersOnPremises===true || input.serviceProvidedForConsiderationToCustomers===true || input.predominantActivityIsSameService===true)
    ) ||
    Boolean(input.relatedToPersonalConsumptionItem) ||
    Boolean(input.suppliedFreeOrBelowMarketToPerson && input.workdayOnPremisesEmployeeProvision!==true);

  const warnings:string[]=[];
  if(input.category==='OTHER') warnings.push('Categoria genérica: classificar a aquisição antes de tratar o resultado como definitivo.');
  if(input.economicActivityRelated===undefined) warnings.push('A relação com a atividade econômica não foi informada.');
  if(input.operationalPurpose===undefined || input.operationalPurpose==='UNKNOWN') warnings.push('A finalidade da aquisição não foi informada.');
  if(CONTEXT_CATEGORIES.has(input.category)) warnings.push('Esta categoria exige análise contextual; não tratar a classificação como crédito automático.');
  if(input.category==='VEHICLE') warnings.push('Veículo e despesas relacionadas podem ser uso/consumo pessoal quando enquadrados no art. 57, II e §1º, II.');
  if(input.category==='FOOD' && input.suppliedFreeOrBelowMarketToPerson && input.workdayOnPremisesEmployeeProvision!==true) {
    warnings.push('Alimentação fornecida a pessoas físicas exige verificar as exceções do art. 57, §3º, IV.');
  }
  if(input.extinctionRequirementWaived===true) warnings.push('A dispensa do requisito de extinção do art. 48 foi informada pelo chamador; o motor não verifica sozinho se as modalidades de extinção realmente não foram implementadas.');
  if(input.documentType && !input.electronicFiscalDocument) warnings.push('documentType informado não substitui a exigência de documento fiscal eletrônico idôneo.');
  if(!input.itemDescription && !input.ncm && !input.cfop) warnings.push('Nenhuma evidência de item (descrição, NCM ou CFOP) foi informada; a classificação permanece dependente dos fatos.');
  if(input.operationTaxTreatment && input.operationTaxTreatment!=='NORMAL') warnings.push('Tratamento tributário especial pode impedir o crédito, salvo hipótese expressa de crédito presumido ou outra exceção.');

  return {
    ibs:decision(input,'IBS'),
    cbs:decision(input,'CBS'),
    personalConsumption:personal,
    warnings,
    source:{
      authority:'PLANALTO',
      law:'LC 214/2025',
      amendments:['LC 227/2026'],
      currentCompilation:true,
      url:OFFICIAL_URL
    },
  };
}
