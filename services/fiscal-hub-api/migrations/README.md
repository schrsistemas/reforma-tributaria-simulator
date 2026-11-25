# PostgreSQL runtime role

Apply 0001_fiscal_hub_core.sql and then 0002_runtime_role.sql using a dedicated migration-owner account.

Set the runtime role password out-of-band, for example with the interactive psql command:

\password fiscal_hub_app

Use fiscal_hub_app in the API DATABASE_URL. It is deliberately NOSUPERUSER and NOBYPASSRLS and must not own the schema or tables.

Do not run the API with the migration-owner or PostgreSQL superuser account. Tenant-owned operations must execute inside the withTenant transaction helper.
