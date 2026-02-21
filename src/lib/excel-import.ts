import * as XLSX from "xlsx";
import { getCountryByCode, findCountryByName } from "@/lib/countries";

// ============================================
// Excel Import – Parser & Template Generator
// for bulk product catalog import
// ============================================

export interface ImportRow {
  rowNumber: number;
  sku: string;
  provider_description: string;
  customs_description: string;
  internal_description: string;
  ncm_code: string;
  country_of_origin: string;
  apertura: number | null;
  status: "ok" | "error" | "warning" | "duplicate";
  errors: string[];
  warnings: string[];
  action: "create" | "update" | "skip";
  selected: boolean;
}

/** Column headers expected in the template / import file */
const TEMPLATE_HEADERS = [
  "SKU",
  "Descripción Comercial",
  "Descripción Aduanera",
  "Descripción Interna",
  "NCM",
  "País de Origen",
  "Apertura",
] as const;

/** Regex for valid NCM codes: 4 digits, optionally .2 digits, optionally .2 more digits */
const NCM_REGEX = /^\d{4}(\.\d{2}(\.\d{2})?)?$/;

/**
 * Parse an Excel file buffer into typed ImportRow[] with validation.
 * Reads the first sheet, expects headers in the first row matching TEMPLATE_HEADERS.
 */
export function parseExcelBuffer(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // Convert to array of arrays (raw rows including header)
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (raw.length < 2) return []; // need at least header + 1 data row

  const rows: ImportRow[] = [];
  const seenSkus = new Set<string>();

  // Skip header row (index 0), process data rows
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i];
    const rowNumber = i + 1; // 1-based, accounting for header

    const rawSku = String(cells[0] ?? "").trim();
    const rawProvDesc = String(cells[1] ?? "").trim();
    const rawCustomsDesc = String(cells[2] ?? "").trim();
    const rawInternalDesc = String(cells[3] ?? "").trim();
    const rawNcm = String(cells[4] ?? "").trim();
    const rawCountry = String(cells[5] ?? "").trim();
    const rawApertura = cells[6];

    const errors: string[] = [];
    const warnings: string[] = [];

    // --- Required field validation ---
    if (!rawSku) {
      errors.push("SKU es obligatorio");
    }
    if (!rawProvDesc) {
      errors.push("Descripción Comercial es obligatoria");
    }

    // --- NCM validation ---
    let ncmCode = "";
    if (rawNcm) {
      if (NCM_REGEX.test(rawNcm)) {
        ncmCode = rawNcm;
      } else {
        errors.push(`NCM inválido: "${rawNcm}" (formato esperado: 0000, 0000.00 o 0000.00.00)`);
      }
    }

    // --- Country of origin resolution ---
    let countryOfOrigin = "";
    if (rawCountry) {
      const numericCode = Number(rawCountry);
      if (!isNaN(numericCode) && String(numericCode) === rawCountry) {
        // Numeric DUA code → resolve to name
        const country = getCountryByCode(numericCode);
        if (country) {
          countryOfOrigin = country.name;
        } else {
          countryOfOrigin = rawCountry;
          warnings.push(`País no reconocido (código: ${rawCountry})`);
        }
      } else {
        // Text name → normalize to canonical name
        const country = findCountryByName(rawCountry);
        if (country) {
          countryOfOrigin = country.name;
        } else {
          countryOfOrigin = rawCountry;
          warnings.push(`País no reconocido: "${rawCountry}"`);
        }
      }
    }

    // --- Apertura validation ---
    let apertura: number | null = null;
    if (rawApertura !== "" && rawApertura !== null && rawApertura !== undefined) {
      const num = Number(rawApertura);
      if (!isNaN(num)) {
        apertura = num;
      } else {
        warnings.push(`Apertura no es un número válido: "${rawApertura}"`);
      }
    }

    // --- Duplicate detection ---
    let status: ImportRow["status"] = "ok";
    if (errors.length > 0) {
      status = "error";
    } else if (rawSku && seenSkus.has(rawSku.toUpperCase())) {
      status = "duplicate";
      warnings.push(`SKU duplicado en el archivo: "${rawSku}"`);
    } else if (warnings.length > 0) {
      status = "warning";
    }

    if (rawSku) {
      seenSkus.add(rawSku.toUpperCase());
    }

    rows.push({
      rowNumber,
      sku: rawSku,
      provider_description: rawProvDesc,
      customs_description: rawCustomsDesc,
      internal_description: rawInternalDesc,
      ncm_code: ncmCode,
      country_of_origin: countryOfOrigin,
      apertura,
      status,
      errors,
      warnings,
      action: "create",
      selected: status !== "error",
    });
  }

  return rows;
}

/**
 * Generate an empty Excel template with the correct headers.
 * Returns an ArrayBuffer ready to be downloaded.
 */
export function generateTemplate(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS.slice()]);

  // Set reasonable column widths
  sheet["!cols"] = [
    { wch: 15 }, // SKU
    { wch: 40 }, // Descripción Comercial
    { wch: 40 }, // Descripción Aduanera
    { wch: 40 }, // Descripción Interna
    { wch: 14 }, // NCM
    { wch: 20 }, // País de Origen
    { wch: 12 }, // Apertura
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, "Mercaderías");

  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return output;
}
