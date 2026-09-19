# Integration sequence

1. Delphi/ERP creates or updates a fiscal operation.
2. Zynkronyx receives the operation event.
3. Zynkronyx generates correlation and idempotency metadata.
4. Zynkronyx calls the fiscal simulator.
5. Fiscal simulator resolves the published RuleSet.
6. Tax Engine calculates the immutable result.
7. Result is persisted with the RuleSet version.
8. Fiscal event is emitted.
9. Zynkronyx updates the Control Center.
10. If payment is involved, Split Payment consumes the immutable calculation snapshot.
11. Settlement events return to the control plane.
12. Reconciliation closes the financial cycle.

The UI never implements tax formulas.
