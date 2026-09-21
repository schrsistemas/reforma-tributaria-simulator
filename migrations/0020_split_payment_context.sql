-- Split Payment context aligned with the fiscal document -> payment transaction -> financial settlement flow.
-- The values are simulator metadata; they do not claim to be an official payment-method code table.

ALTER TABLE split_payments ADD COLUMN payment_instrument TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE split_payments ADD COLUMN settlement_mode TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE split_payments ADD COLUMN fiscal_document_id TEXT;
ALTER TABLE split_payments ADD COLUMN payment_transaction_id TEXT;
ALTER TABLE split_payments ADD COLUMN extinguished_taxes_json TEXT NOT NULL DEFAULT '{"IBS":"0.00","CBS":"0.00"}';

CREATE INDEX IF NOT EXISTS idx_split_payments_fiscal_document
  ON split_payments(tenant_id,fiscal_document_id);

CREATE INDEX IF NOT EXISTS idx_split_payments_payment_transaction
  ON split_payments(tenant_id,payment_transaction_id);

CREATE INDEX IF NOT EXISTS idx_split_payments_context
  ON split_payments(tenant_id,payment_instrument,settlement_mode);
