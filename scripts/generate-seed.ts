// scripts/generate-seed.ts
import { readFileSync, writeFileSync } from "fs";

const CSV_PATH = "data/ncm_nomenclator.csv";
const OUTPUT_PATH = "supabase/seed.sql";

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const content = readFileSync(CSV_PATH, "utf-8");
const lines = content.split("\n").filter((l) => l.trim());
const header = lines[0].split(",");

const idx = {
  ncm_code: header.indexOf("ncm_code"),
  full_description: header.indexOf("full_description"),
  chapter: header.indexOf("chapter"),
  aec: header.indexOf("aec"),
};

let sql = "-- Auto-generated seed: NCM nomenclator\n";
sql += "-- Run: npx tsx scripts/generate-seed.ts\n\n";

const BATCH = 500;
let values: string[] = [];
let totalRows = 0;

const escaped = (s: string) => s.replace(/'/g, "''");

for (let i = 1; i < lines.length; i++) {
  const fields = parseCSVLine(lines[i]);
  if (fields.length < 5) continue;
  const ncm_code = fields[idx.ncm_code]?.trim();
  const full_desc = fields[idx.full_description]?.trim();
  const chapter = fields[idx.chapter]?.trim();
  const aec = fields[idx.aec]?.trim();
  if (!ncm_code || !full_desc) continue;

  const notes = aec ? `'AEC: ${escaped(aec)}'` : "NULL";
  values.push(
    `('${escaped(ncm_code)}', '${escaped(full_desc)}', '', '${escaped(chapter)}', ${notes})`
  );
  totalRows++;

  if (values.length >= BATCH) {
    sql += `INSERT INTO ncm_nomenclator (ncm_code, description, section, chapter, notes) VALUES\n`;
    sql += values.join(",\n") + "\nON CONFLICT (ncm_code) DO NOTHING;\n\n";
    values = [];
  }
}

if (values.length > 0) {
  sql += `INSERT INTO ncm_nomenclator (ncm_code, description, section, chapter, notes) VALUES\n`;
  sql += values.join(",\n") + "\nON CONFLICT (ncm_code) DO NOTHING;\n\n";
}

writeFileSync(OUTPUT_PATH, sql);
console.log(`Seed written to ${OUTPUT_PATH} (${totalRows} rows)`);
