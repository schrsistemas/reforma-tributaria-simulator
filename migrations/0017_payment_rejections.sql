-- Simulated payment-method catalog and rejection scenarios.
-- These scenarios are explicitly simulation data; they are not asserted as official fiscal rejection codes.

CREATE TABLE IF NOT EXISTS payment_methods (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rail TEXT NOT NULL CHECK (rail IN ('BOLETO','PIX','TED','TEF')),
  description TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS payment_rejection_scenarios (
  id TEXT PRIMARY KEY,
  payment_method_code TEXT NOT NULL,
  rejection_code TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  technical_detail TEXT,
  recoverable INTEGER NOT NULL DEFAULT 1 CHECK (recoverable IN (0,1)),
  source_kind TEXT NOT NULL DEFAULT 'SIMULATION' CHECK (source_kind = 'SIMULATION'),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  FOREIGN KEY(payment_method_code) REFERENCES payment_methods(code)
);

CREATE INDEX IF NOT EXISTS idx_payment_rejection_method
  ON payment_rejection_scenarios(payment_method_code, active);

CREATE INDEX IF NOT EXISTS idx_payment_rejection_code
  ON payment_rejection_scenarios(rejection_code, active);

CREATE TABLE IF NOT EXISTS payment_rejection_simulations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payment_method_code TEXT NOT NULL,
  rejection_scenario_id TEXT NOT NULL,
  rejection_code TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  status TEXT NOT NULL DEFAULT 'REJECTED' CHECK (status = 'REJECTED'),
  recoverable INTEGER NOT NULL CHECK (recoverable IN (0,1)),
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(payment_method_code) REFERENCES payment_methods(code),
  FOREIGN KEY(rejection_scenario_id) REFERENCES payment_rejection_scenarios(id),
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_rejection_sim_tenant_operation
  ON payment_rejection_simulations(tenant_id, operation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_rejection_sim_correlation
  ON payment_rejection_simulations(correlation_id);

INSERT OR IGNORE INTO payment_methods(code,name,rail,description) VALUES
  ('15','Boleto','BOLETO','Boleto bancário'),
  ('17','Pix QR Code dinâmico','PIX','Pix via QR Code dinâmico'),
  ('18','TED','TED','Transferência Eletrônica Disponível'),
  ('20','Pix chave / QR estático','PIX','Pix por chave ou QR Code estático'),
  ('23','Pix automático','PIX','Pix automático'),
  ('24','TEF / Book Transfer','TEF','TEF ou book transfer');

INSERT OR IGNORE INTO payment_rejection_scenarios
  (id,payment_method_code,rejection_code,title,message,technical_detail,recoverable,source_kind)
SELECT
  'PAY-' || code || '-1003',
  code,
  '1003',
  'Tipo de pagamento inválido',
  'O meio de pagamento informado foi configurado para uma simulação de rejeição.',
  'Cenário controlado do simulador. O código 1003 deve ser tratado como dado de cenário até ser vinculado a evidência normativa oficial.',
  1,
  'SIMULATION'
FROM payment_methods;

INSERT OR IGNORE INTO payment_rejection_scenarios
  (id,payment_method_code,rejection_code,title,message,technical_detail,recoverable,source_kind)
SELECT
  'PAY-' || code || '-MISSING',
  code,
  'SIM-MISSING',
  'Código de pagamento ausente',
  'A operação não possui código de meio de pagamento informado.',
  'Cenário sintético para testes de validação.',
  1,
  'SIMULATION'
FROM payment_methods;
