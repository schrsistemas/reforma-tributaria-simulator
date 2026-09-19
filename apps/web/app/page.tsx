const metrics = [
  ['Motor fiscal', 'IBS + CBS'],
  ['Regras', 'Versionadas'],
  ['Split Payment', 'Workflow'],
  ['Auditoria', 'Imutável']
];

export default function Home() {
  return (
    <main>
      <p className="muted">REFORMA TRIBUTÁRIA · LABORATÓRIO</p>
      <h1>Simulador Tributário</h1>
      <p className="muted">
        Cenários reproduzíveis para cálculo fiscal, transição e liquidação financeira.
      </p>

      <section className="grid">
        {metrics.map(([title, value]) => (
          <article className="card" key={title}>
            <div className="muted">{title}</div>
            <div className="metric">{value}</div>
          </article>
        ))}
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Novo cenário</h2>
        <p className="muted">
          A interface de entrada será ligada ao Scenario Runner e ao catálogo de regras.
        </p>
        <button type="button">Criar simulação</button>
      </section>
    </main>
  );
}
