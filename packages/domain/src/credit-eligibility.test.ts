import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCreditEligibility } from './credit-eligibility.js';

test('classifica joias como uso ou consumo pessoal',()=>{
  const r=evaluateCreditEligibility({category:'JEWELRY',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true});
  assert.equal(r.personalConsumption,true);
  assert.equal(r.ibs.eligibility,'INELIGIBLE');
  assert.equal(r.cbs.reason,'PERSONAL_CONSUMPTION');
});

test('aquisição operacional com documento e extinção pode gerar IBS e CBS',()=>{
  const r=evaluateCreditEligibility({category:'RAW_MATERIALS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,economicActivityRelated:true});
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
  const r=evaluateCreditEligibility({category:'GOODS',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true,suppliedFreeOrBelowMarketToPerson:true});
  assert.equal(r.ibs.eligibility,'INELIGIBLE');
  assert.equal(r.ibs.reason,'PERSONAL_CONSUMPTION');
});

test('resultado mantém IBS e CBS segregados',()=>{
  const r=evaluateCreditEligibility({category:'CONTRACTED_SERVICES',regularTaxpayer:true,electronicFiscalDocument:true,taxDebtExtinguished:true});
  assert.notEqual(r.ibs.tax,r.cbs.tax);
  assert.equal(r.ibs.tax,'IBS');
  assert.equal(r.cbs.tax,'CBS');
});
