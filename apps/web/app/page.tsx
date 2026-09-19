"use client";
import { useMemo, useState } from "react";

type Tax = { base:string; ratePercent:string; amount:string };
export default function Home(){
  const [base,setBase]=useState("1000.00"),[ibs,setIbs]=useState("10.00"),[cbs,setCbs]=useState("5.00");
  const calc=useMemo(()=>{const b=Number(base)||0,i=Number(ibs)||0,c=Number(cbs)||0;return {ibs:(b*i/100).toFixed(2),cbs:(b*c/100).toFixed(2),total:(b*(i+c)/100).toFixed(2)}},[base,ibs,cbs]);
  return <main className="shell"><header><div><span className="eyebrow">FISCAL DOMAIN</span><h1>Reforma Tributária Simulator</h1><p>Simulação fiscal, Rule Catalog e Split Payment em uma única visão.</p></div><span className="status">● ENGINE ONLINE</span></header>
  <section className="hero"><div><span className="pill">SANDBOX / SCENARIO</span><h2>Teste uma operação</h2><p>Este painel visual usa uma simulação local de cenário. As alíquotas exibidas são demonstrativas e não representam alíquotas legais.</p></div><div className="metric"><small>TOTAL TRIBUTOS</small><strong>R$ {calc.total}</strong><span>IBS + CBS</span></div></section>
  <section className="grid"><div className="card form"><h3>Operação</h3><label>Base tributável<input value={base} onChange={e=>setBase(e.target.value)}/></label><label>IBS (%)<input value={ibs} onChange={e=>setIbs(e.target.value)}/></label><label>CBS (%)<input value={cbs} onChange={e=>setCbs(e.target.value)}/></label><button>Executar cenário</button></div>
  <div className="card"><h3>Breakdown fiscal</h3><div className="row"><span>Base</span><b>R$ {Number(base||0).toFixed(2)}</b></div><div className="row"><span>IBS</span><b>R$ {calc.ibs}</b></div><div className="row"><span>CBS</span><b>R$ {calc.cbs}</b></div><div className="total"><span>Total</span><b>R$ {calc.total}</b></div></div>
  <div className="card"><h3>Pipeline</h3><div className="step done">01 <span>RuleSet</span><small>scenario rules</small></div><div className="step done">02 <span>Tax Engine</span><small>decimal / deterministic</small></div><div className="step">03 <span>Snapshot</span><small>D1 persistence</small></div><div className="step">04 <span>Split Payment</span><small>ledger allocation</small></div></div></section>
  <footer>Fiscal Domain Plane · Zynkronyx integration ready · v0.2</footer></main>
}