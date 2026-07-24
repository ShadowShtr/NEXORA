// OWASP CSV/spreadsheet injection: a field starting with =, +, -, @, tab or CR is
// interpreted as a formula by Excel/Sheets/LibreOffice when the file is opened as CSV
// (always) or as XLSX (under some autocorrect/locale settings once a user edits the
// cell) — a client name like "=cmd|'/c calc'!A1" or a description starting with "-". A
// leading apostrophe forces text interpretation without changing the visible value:
// Excel and LibreOffice both hide a leading "'" in a cell's display. Shared by CSV
// (NEX-132) and Excel (NEX-133) export — same user-controlled text (client names,
// service descriptions), same risk, same fix.
export function guardFormulaInjection(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
