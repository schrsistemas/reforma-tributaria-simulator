import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCreditEligibility } from './credit-eligibility.js';

test('classifica joias como uso ou consumo pessoal',()=>{
  const r=evaluateCreditEligibility({category:'JEWELRY',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'BUSINESS'});
  assert.equal(r.personalConsumption,true);
  assert.equal(r.ibs.eligibility,'INELIGIBLE');
  assert.equal(r.cbs.reason,'PERSONAL_CONSUMPTION');
  assert.equal(r.ibs.ruleId,'CE-057-I');
});

test('joias comercializadas ou usadas na fabricação para revenda entram na exceção do art. 57 §3º',()=>{
  const r=evaluateCreditEligibility({category:'JEWELRY',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'BUSINESS',commercializedOrUsedForManufacturing:true});
  assert.equal(r.ibs.eligibility,'ELIGIBLE');
  assert.equal(r.ibs.ruleId,'CE-057-EXCEPTION');
  assert.equal(r.personalConsumption,false);
});

test('armas utilizadas por empresa de segurança entram na exceção do art. 57 §3º',()=>{
  const r=evaluateCreditEligibility({category:'WEAPONS_AMMUNITION',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'BUSINESS',usedBySecurityCompany:true});
  assert.equal(r.ibs.eligibility,'ELIGIBLE');
  assert.equal(r.ibs.ruleId,'CE-057-EXCEPTION');
});

test('aquisição operacional com documento e extinção pode gerar IBS e CBS',()=>{
  const r=evaluateCreditEligibility({category:'RAW_MATERIALS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'BUSINESS'});
  assert.equal(r.ibs.eligibility,'ELIGIBLE');
  assert.equal(r.cbs.eligibility,'ELIGIBLE');
});

test('sem documento fiscal eletrônico fica condicional',()=>{
  const r=evaluateCreditEligibility({category:'MACHINERY',regularTaxpayer:true,electronicFiscalDocument:false,taxDebtExtinguished:true});
  assert.equal(r.ibs.eligibility,'CONDITIONAL');
  assert.equal(r.ibs.reason,'DOCUMENT_REQUIRED');
});

test('combustível em regime específico usa regra própria do art. 47',()=>{
  const r=evaluateCreditEligibility({category:'FUEL',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:false,fuelSpecificRegime:true});
  assert.equal(r.ibs.eligibility,'ELIGIBLE');
  assert.deepEqual(r.ibs.legalBasis,['LC 214/2025, art. 47 (§§4º e 5º)']);
});

test('fornecimento gratuito ou abaixo do mercado para pessoa gera bloqueio de crédito pessoal',()=>{
  const r=evaluateCreditEligibility({category:'GOODS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,suppliedFreeOrBelowMarketToPerson:true,economicActivityRelated:true,operationalPurpose:'BUSINESS'});
  assert.equal(r.ibs.eligibility,'INELIGIBLE');
  assert.equal(r.ibs.reason,'PERSONAL_CONSUMPTION');
  assert.equal(r.ibs.ruleId,'CE-057-II');
});

test('alimentação no estabelecimento durante a jornada pode cair na exceção do art. 57 §3º, IV',()=>{
  const r=evaluateCreditEligibility({category:'FOOD',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,suppliedFreeOrBelowMarketToPerson:true,workdayOnPremisesEmployeeProvision:true,economicActivityRelated:true,operationalPurpose:'BUSINESS'});
  assert.notEqual(r.ibs.ruleId,'CE-057-II');
});

test('resultado mantém IBS e CBS segregados',()=>{
  const r=evaluateCreditEligibility({category:'CONTRACTED_SERVICES',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true});
  assert.notEqual(r.ibs.tax,r.cbs.tax);
  assert.equal(r.ibs.tax,'IBS');
  assert.equal(r.cbs.tax,'CBS');
});

test('sem informação sobre atividade econômica permanece condicional',()=>{
  const r=evaluateCreditEligibility({category:'GOODS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true});
  assert.equal(r.ibs.eligibility,'CONDITIONAL');
  assert.equal(r.ibs.reason,'INSUFFICIENT_FACTS');
});

test('regime não regular exige análise específica em vez de bloqueio definitivo',()=>{
  const r=evaluateCreditEligibility({category:'GOODS',regularTaxpayer:false,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true});
  assert.equal(r.ibs.eligibility,'CONDITIONAL');
  assert.equal(r.ibs.reason,'FISCAL_REGIME_EXCEPTION');
});

test('veículo sem contexto não recebe crédito automático',()=>{
  const r=evaluateCreditEligibility({category:'VEHICLE',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'BUSINESS'});
  assert.equal(r.ibs.eligibility,'CONDITIONAL');
  assert.equal(r.ibs.reason,'CONTEXT_SPECIFIC');
});

test('finalidade pessoal isolada não é convertida artificialmente em art. 57 I',()=>{
  const r=evaluateCreditEligibility({category:'MACHINERY',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'PERSONAL'});
  assert.equal(r.ibs.eligibility,'CONDITIONAL');
  assert.equal(r.ibs.ruleId,'CE-CONTEXT');
});

test('operação imune/isenta/alíquota zero/diferimento/suspensão exige verificação do art. 49',()=>{
  const r=evaluateCreditEligibility({category:'RAW_MATERIALS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'BUSINESS',operationTaxTreatment:'ZERO_RATE'});
  assert.equal(r.ibs.eligibility,'CONDITIONAL');
  assert.equal(r.ibs.ruleId,'CE-049');
});

test('art. 48 pode afastar temporariamente o requisito de extinção quando configurado',()=>{
  const r=evaluateCreditEligibility({category:'RAW_MATERIALS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:false,extinctionRequirementWaived:true,economicActivityRelated:true,operationalPurpose:'BUSINESS'});
  assert.equal(r.ibs.eligibility,'ELIGIBLE');
  assert.equal(r.ibs.ruleId,'CE-047-GENERAL');
});

test('descrição/NCM/CFOP passam a ser evidências explícitas do item',()=>{
  const r=evaluateCreditEligibility({category:'GOODS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true,operationalPurpose:'BUSINESS',ncm:'8471.30.12',cfop:'1102',itemDescription:'Equipamento'});
  assert.equal(r.warnings.some(w=>w.includes('Nenhuma evidência de item')),false);
});
