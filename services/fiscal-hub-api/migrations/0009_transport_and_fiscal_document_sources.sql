BEGIN;

-- Official index covering the national electronic fiscal document ecosystem.
INSERT INTO fiscal.normative_sources
  (name, authority, source_type, jurisdiction, official_url)
VALUES
  ('SPED — Catálogo oficial de documentos fiscais eletrônicos', 'Secretaria Especial da Receita Federal do Brasil / SPED', 'OFFICIAL_DOCUMENT_INDEX', 'NATIONAL',
   'https://www.gov.br/sped/pt-br/assuntos/documentos-fiscais'),
  ('CT-e e CT-e OS — Portal Nacional e documentação técnica', 'ENCAT / Receita Federal / Administrações Tributárias Estaduais', 'FISCAL_DOCUMENT_PORTAL', 'NATIONAL',
   'https://www.cte.fazenda.gov.br/portal/'),
  ('MDF-e — Portal Nacional e documentação técnica', 'ENCAT / Administrações Tributárias Estaduais', 'FISCAL_DOCUMENT_PORTAL', 'NATIONAL',
   'https://www.mdfe.fazenda.gov.br/portal/'),
  ('GNRE — Portal Nacional de arrecadação', 'Secretaria da Fazenda de Pernambuco / CONFAZ', 'TAX_COLLECTION_PORTAL', 'NATIONAL',
   'https://www.gnre.pe.gov.br:444/gnre/portal/GNRE_Principal.jsp'),
  ('ANTT — CIOT Para Todos: legislação e orientações', 'Agência Nacional de Transportes Terrestres', 'REGULATORY_PORTAL', 'FEDERAL',
   'https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1'),
  ('ANTT — CIOT: documentação técnica e integração', 'Agência Nacional de Transportes Terrestres', 'TECHNICAL_DOCUMENTATION', 'FEDERAL',
   'https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1/documentos-tecnicos'),
  ('ANTT — CIOT: perguntas frequentes', 'Agência Nacional de Transportes Terrestres', 'FAQ_REFERENCE', 'FEDERAL',
   'https://www.gov.br/antt/pt-br/assuntos/cargas/ciot-para-todos-1/perguntas-frequentes')
ON CONFLICT (official_url) DO UPDATE
  SET name = EXCLUDED.name,
      authority = EXCLUDED.authority,
      source_type = EXCLUDED.source_type,
      jurisdiction = EXCLUDED.jurisdiction,
      active = true;

-- The national NF-e portal also publishes NFC-e technical notes, schemas and
-- operating notices. Keep one source per canonical URL, with both models named.
UPDATE fiscal.normative_sources
   SET name = 'NF-e e NFC-e — Portal Nacional, notas técnicas e esquemas',
       authority = 'ENCAT / Receita Federal / Administrações Tributárias Estaduais',
       source_type = 'FISCAL_DOCUMENT_PORTAL',
       jurisdiction = 'NATIONAL',
       active = true
 WHERE official_url = 'https://www.nfe.fazenda.gov.br/portal/principal.aspx';

COMMIT;
