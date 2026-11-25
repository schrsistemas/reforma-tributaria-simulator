# PostgreSQL migrations

Apply migrations in numeric order with a dedicated migration-owner account:

1. 0001_fiscal_hub_core.sql
2. 0002_runtime_role.sql
3. 0003_integrity_constraints.sql
4. 0004_seed_normative_sources.sql

The runtime role must not own these objects and must remain NOSUPERUSER/NOBYPASSRLS. Set its password out-of-band after applying migration 0002.

Migration 0003 closes a tenant-integrity gap in the ERP event relationship, validates stored CNPJ and SHA-256 formats, adds query indexes, and makes audit rows append-only to the runtime role.

Migration 0004 seeds a starter list of official Brazilian federal and national fiscal sources. It stores source registry entries only; it does not scrape, interpret or approve legal content.

Always validate migrations against a disposable PostgreSQL database before production. There is no automatic migration execution at API startup.
