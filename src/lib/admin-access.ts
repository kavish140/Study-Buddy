export const ADMIN_EMAIL = "kavishganatra5@gmail.com";

// This controls navigation only. Every privileged RPC independently authorizes in SQL.
export function hasAdminEmail(email?: string | null) {
  return email?.toLowerCase() === ADMIN_EMAIL;
}

export function csvExport(rows: Record<string, unknown>[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value: unknown) => {
    let text =
      value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    // Prevent spreadsheet formula execution when exporting user content.
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(cell).join(","),
    ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
  ].join("\r\n");
}
