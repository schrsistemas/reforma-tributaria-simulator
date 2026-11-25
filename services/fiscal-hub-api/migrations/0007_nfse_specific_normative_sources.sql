BEGIN;

-- Specific NFS-e Via sources are monitored independently from the general
-- NFS-e portal so a change in one technical artifact page is traceable.
-- The FAQ is registered as reference guidance, not as a normative act.
INSERT INTO fiscal.normative_sources
  (name, authority, source_type, jurisdiction, official_url)
VALUES
  ('NFS-e Via — Manuais e Anexos', 'Comitê Gestor da NFS-e', 'TECHNICAL_DOCUMENTATION', 'NATIONAL',
   'https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica/manuais-e-anexos'),
  ('NFS-e Via — Esquemas XSD', 'Comitê Gestor da NFS-e', 'SCHEMA_REPOSITORY', 'NATIONAL',
   'https://www.gov.br/nfse/pt-br/nfs-e-via/documentacao-tecnica/arquivos-dos-esquemas-xsd'),
  ('NFS-e Via — Links oficiais e APIs', 'Comitê Gestor da NFS-e', 'API_DIRECTORY', 'NATIONAL',
   'https://www.gov.br/nfse/pt-br/nfs-e-via/links'),
  ('Ato Conjunto RFB/CGIBS nº 7/2026 — Cronograma NFS-e', 'Receita Federal / Comitê Gestor do IBS', 'NORMATIVE_COMMUNICATION', 'NATIONAL',
   'https://www.gov.br/nfse/pt-br/noticias/cgnfs-e-informa-ato-conjunto-rfb-cgibs-no-7-2026-atualiza-o-cronograma-de-obrigatoriedade-de-emissao-da-nfs-e-para-ibs-e-cbs'),
  ('NFS-e — Perguntas Frequentes versão 1.5 (23/11/2026)', 'Receita Federal / Comitê Gestor da NFS-e', 'FAQ_REFERENCE', 'NATIONAL',
   'https://www.gov.br/nfse/pt-br/perguntas-frequentes/perguntas-frequentes-nfs-e-v1-5-20261123.pdf')
ON CONFLICT (official_url) DO UPDATE
  SET name = EXCLUDED.name,
      authority = EXCLUDED.authority,
      source_type = EXCLUDED.source_type,
      jurisdiction = EXCLUDED.jurisdiction,
      active = true;

COMMIT;
