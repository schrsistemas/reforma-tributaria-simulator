CREATE TABLE IF NOT EXISTS regulatory_changes (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL, old_document_id TEXT, new_document_id TEXT NOT NULL,
 detected_at TEXT NOT NULL, change_type TEXT NOT NULL, added_count INTEGER NOT NULL DEFAULT 0,
 removed_count INTEGER NOT NULL DEFAULT 0, impacted_areas_json TEXT NOT NULL, summary TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_regulatory_changes_source ON regulatory_changes(source_id,detected_at);
CREATE INDEX IF NOT EXISTS idx_regulatory_changes_new_document ON regulatory_changes(new_document_id);