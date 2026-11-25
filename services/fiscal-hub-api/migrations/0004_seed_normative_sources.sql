BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_normative_sources_official_url
  ON fiscal.normative_sources(official_url);

INSERT INTO fiscal.normative_sources
  (name, authority, source_type, jurisdiction, official_url)
VALUES
  ('Portal da Legislação Federal', 'Presidência da República / Casa Civil', 'LEGISLATION', 'FEDERAL',
   'https://www.planalto.gov.br/ccivil_03/'),
  ('Receita Federal do Brasil', 'Secretaria Especial da Receita Federal do Brasil', 'GOVERNMENT_PORTAL', 'FEDERAL',
   'https://www.gov.br/receitafederal/pt-br'),
  ('Portal Nacional da NF-e', 'Encontro Nacional de Coordenadores e Administradores Tributários Estaduais', 'FISCAL_DOCUMENT_PORTAL', 'NATIONAL',
   'https://www.nfe.fazenda.gov.br/portal/principal.aspx'),
  ('Portal Nacional da NFS-e', 'Comitê Gestor da Nota Fiscal de Serviço Eletrônica', 'FISCAL_DOCUMENT_PORTAL', 'NATIONAL',
   'https://www.gov.br/nfse/pt-br'),
  ('CONFAZ', 'Conselho Nacional de Política Fazendária', 'NORMATIVE_PORTAL', 'NATIONAL',
   'https://www.confaz.fazenda.gov.br/'),
  ('Ministério da Fazenda — Reforma Tributária', 'Ministério da Fazenda', 'GOVERNMENT_PORTAL', 'FEDERAL',
   'https://www.gov.br/fazenda/pt-br/assuntos/reforma-tributaria')
ON CONFLICT (official_url) DO NOTHING;

COMMIT;
