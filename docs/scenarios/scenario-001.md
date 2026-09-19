# Scenario 001 — Venda normal

## Purpose

Validate the deterministic path from fiscal operation to IBS/CBS calculation.

## Inputs

- Operation: OP-001
- Date: 2026-09-19
- Gross value: R$ 1,000.00
- Quantity: 2
- Unit price: R$ 500.00

## Test parameters

These are explicit TEST rules and are not legal rates.

- IBS: 10.00%
- CBS: 5.00%

## Expected

- Taxable base: R$ 1,000.00
- IBS: R$ 100.00
- CBS: R$ 50.00
- Total: R$ 150.00

The scenario validates the software engine only.
