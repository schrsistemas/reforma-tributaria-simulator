INSERT OR IGNORE INTO fiscal_sources
(id,authority,name,source_type,official_url,collection_method,cadence,enabled,created_at,updated_at)
VALUES
('RFB-RTC','Receita Federal','Reforma Tributária do Consumo','OFFICIAL_GUIDANCE','https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo','HTTP','DAILY',1,datetime('now'),datetime('now')),
('RFB-RTC-LEG','Receita Federal','Legislação da Reforma Tributária do Consumo','LAW','https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/legislacao','HTTP','DAILY',1,datetime('now'),datetime('now')),
('RFB-RTC-ATOS','Receita Federal/CGIBS','Atos Conjuntos','ACT','https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/legislacao/atos-conjuntos','HTTP','DAILY',1,datetime('now'),datetime('now')),
('RFB-TECH','Receita Federal','Documentos Técnicos','TECHNICAL_NOTE','https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos','HTTP','DAILY',1,datetime('now'),datetime('now')),
('RFB-DFE','Receita Federal/CGIBS','Cronograma de Documentos Fiscais Eletrônicos da Reforma Tributária','CALENDAR','https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-da-reforma-tributaria','HTTP','DAILY',1,datetime('now'),datetime('now')),
('PLANALTO-LCP214','Presidência da República','Lei Complementar 214/2025','LAW','https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm','HTTP','DAILY',1,datetime('now'),datetime('now'));
