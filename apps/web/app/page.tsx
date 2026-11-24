"use client";

import { useMemo, useState } from "react";

function parseMoney(value: string): bigint {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return 0n;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function formatMoney(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(whole) + Number(fraction) / 100);
}

export default function Home() {
  const [base, setBase] = useState("1000.00");
  const [ibs, setIbs] = useState("10.00");
  const [cbs, setCbs] = useState("5.00");
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_URL ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const preview = useMemo(() => {
    const amount = parseMoney(base);
    const ibsRate = parseMoney(ibs);
    const cbsRate = parseMoney(cbs);
    const ibsAmount = amount * ibsRate / 10000n;
    const cbsAmount = amount * cbsRate / 10000n;
    return {
      ibs: formatMoney(ibsAmount),
      cbs: formatMoney(cbsAmount),
      total: formatMoney(ibsAmount + cbsAmount),
    };
  }, [base, ibs, cbs]);

  async function executeScenario() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const url = apiUrl.trim().replace(/\/$/, "");
      if (!url) throw new Error("Informe a URL da API.");
      const correlationId = crypto.randomUUID();
      const response = await fetch(url + "/api/v1/simulations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Correlation-Id": correlationId,
          "Idempotency-Key": correlationId,
          "X-Zynkronyx-Tenant": "demo",
        },
        body: JSON.stringify({
          executionMode: "SCENARIO",
          operation: {
            id: "WEB-" + correlationId,
            issuedAt: new Date().toISOString().slice(0, 10),
            grossAmount: base,
            currency: "BRL",
            items: [{
              id: "1",
              description: "Cenário demonstrativo",
              quantity: "1",
              unitPrice: base,
              taxProfile: { regime: "NORMAL" },
            }],
          },
          rules: [
            { id: "IBS-WEB", tax: "IBS", validFrom: "2026-01-01", ratePercent: ibs, source: "WEB-SCENARIO", version: "demo" },
            { id: "CBS-WEB", tax: "CBS", validFrom: "2026-01-01", ratePercent: cbs, source: "WEB-SCENARIO", version: "demo" },
          ],
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error("A API recusou o cenário (HTTP " + response.status + ").");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao executar cenário.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header>
        <div>
          <span className="eyebrow">FISCAL DOMAIN / SANDBOX</span>
          <h1>Reforma Tributária Simulator</h1>
          <p>Workbench de cenários, regras versionadas e integração fiscal.</p>
        </div>
        <span className="status">● AMBIENTE DE TESTE</span>
      </header>
      <section className="hero">
        <div>
          <span className="pill">CÁLCULO DEMONSTRATIVO</span>
          <h2>Teste uma operação</h2>
          <p>As alíquotas abaixo são parâmetros livres de cenário. Não representam regras legais nem substituem a Calculadora de Tributos da Receita Federal.</p>
        </div>
        <div className="metric">
          <small>TOTAL ESTIMADO</small>
          <strong>{preview.total}</strong>
          <span>IBS + CBS • hipótese informada</span>
        </div>
      </section>
      <section className="grid">
        <div className="card form">
          <h3>Parâmetros do cenário</h3>
          <label>Base de referência (R$)<input inputMode="decimal" value={base} onChange={event => setBase(event.target.value)} /></label>
          <label>IBS hipotético (%)<input inputMode="decimal" value={ibs} onChange={event => setIbs(event.target.value)} /></label>
          <label>CBS hipotética (%)<input inputMode="decimal" value={cbs} onChange={event => setCbs(event.target.value)} /></label>
          <label>URL da API<input type="url" placeholder="https://..." value={apiUrl} onChange={event => setApiUrl(event.target.value)} /></label>
          <button onClick={executeScenario} disabled={busy}>{busy ? "Executando..." : "Executar cenário"}</button>
          {error && <p className="error" role="alert">{error}</p>}
          {result && <pre className="result">{JSON.stringify(result, null, 2)}</pre>}
        </div>
        <div className="card">
          <h3>Memória matemática do cenário</h3>
          <div className="row"><span>Base informada</span><b>{formatMoney(parseMoney(base))}</b></div>
          <div className="row"><span>IBS hipotético</span><b>{preview.ibs}</b></div>
          <div className="row"><span>CBS hipotética</span><b>{preview.cbs}</b></div>
          <div className="total"><span>Total estimado</span><b>{preview.total}</b></div>
          <p>Este painel aplica apenas percentuais informados manualmente, com aritmética inteira em centavos. Não resolve enquadramento, base legal, crédito ou classificação tributária.</p>
        </div>
        <div className="card">
          <h3>Pipeline fiscal</h3>
          <div className="step done">01 <span>RuleSet</span><small>cenário explicitamente informado</small></div>
          <div className="step done">02 <span>Tax Engine</span><small>aritmética decimal determinística</small></div>
          <div className="step">03 <span>Snapshot</span><small>persistência auditável</small></div>
          <div className="step">04 <span>Split Payment</span><small>fluxo separado do cálculo</small></div>
        </div>
      </section>
      <footer>Fiscal Domain Plane · resultados demonstrativos · versão 0.3</footer>
    </main>
  );
}
