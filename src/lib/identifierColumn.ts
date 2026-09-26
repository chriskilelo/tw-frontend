// Shared across every table implementation (src/components/Table.tsx, and the bespoke
// structured-table editor in ReportFormPage.tsx) so "which column is a record identifier"
// is decided the same way everywhere, rather than duplicated per table.
//
// Matches a column's machine key (e.g. `reference_number`) or human label (e.g. "Item
// Number", "Serial Number") on whole words only, so it catches common variations without
// false-positiving on unrelated columns that merely contain "id" as a substring (e.g. a
// foreign-key column used as a React key, `kpi_definition_id` — underscores count as word
// characters for \b, so "id" only matches there as a standalone word).
const IDENTIFIER_COLUMN_PATTERN = /\b(id|reference|ref|code|record_id|number)\b/i

export function isIdentifierColumn(nameOrKey: string): boolean {
  return IDENTIFIER_COLUMN_PATTERN.test(nameOrKey)
}
