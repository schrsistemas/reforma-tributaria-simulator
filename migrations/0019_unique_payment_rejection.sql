-- Enforce one persisted rejection simulation per Split Payment.
-- NULL payment_id remains allowed for standalone rejection simulations.

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_rejection_sim_payment
  ON payment_rejection_simulations(tenant_id,payment_id)
  WHERE payment_id IS NOT NULL;
