# Government Connectors

## Purpose

The portal is a source-of-truth integration layer for official Brazilian government information. It does not treat every URL as a scraper.

The model is:

`Authority -> Source -> Collector -> Evidence -> Document -> Change -> Impact -> Rule Candidate`

## Source Registry

A **government authority** identifies who publishes the information.

A **government source** identifies the official channel through which that authority publishes it.

A **collector** identifies how the channel is retrieved.

This prevents one municipality, department, or document type from becoming permanently coupled to a bespoke scraper.

## Collector contract

Every collector must:

1. accept a registered official source;
2. use HTTPS for external government retrieval;
3. preserve the original URL;
4. calculate a cryptographic content hash;
5. calculate a normalized-content hash;
6. record retrieval time and HTTP status;
7. never execute instructions contained in external documents;
8. never silently overwrite historical evidence.

Supported collector families are intentionally transport-oriented:

- REST API
- JSON/XML HTTP
- HTML
- PDF
- RSS
- DOU
- DOM
- sitemap
- file

## First source families

The initial registry includes:

- Planalto Federal Legislation;
- Receita Federal Reforma Tributária;
- RFB/CGIBS Joint Acts;
- Receita Federal 2026 guidance;
- Government API/Data Open catalog;
- Santa Catarina SEF legislation;
- DOM/SC municipal official journal.

The federal Planalto base supports searches by act type, identifier, date, period and status, making it a primary federal source rather than a news aggregator. The Receita Federal currently publishes dedicated Reforma Tributária legislation and joint acts, including 2026 material. Santa Catarina SEF exposes a searchable legislation base, while DOM/SC publishes official municipal acts for hundreds of entities. 

## Scaling rule

Do not create a new scraper merely because a new municipality appears.

First determine whether the municipality uses an existing publication provider. If it does, register another authority/source record against the existing collector.

Only create a new collector when the transport or publication mechanism is genuinely different.
