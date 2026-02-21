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

/** Normalize header text for matching (lowercase, strip accents, trim) */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Map of normalized header → canonical field key */
const HEADER_MAP: Record<string, string> = {
  sku: "sku",
  descripcioncomercial: "provider_description",
  descripcionaduanera: "customs_description",
  descripcioninterna: "internal_description",
  ncm: "ncm_code",
  paisdeorigen: "country_of_origin",
  apertura: "apertura",
};

/**
 * Parse an Excel file buffer into typed ImportRow[] with validation.
 * Reads the first sheet, maps columns by header name (tolerant of accents/casing).
 */
export function parseExcelBuffer(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // Read as array of arrays to get raw header row
  const rawArrays: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (rawArrays.length < 2) return []; // need at least header + 1 data row

  // Build column index map from header row
  const headerRow = rawArrays[0];
  const colMap: Record<string, number> = {};
  for (let c = 0; c < headerRow.length; c++) {
    const normalized = normalizeHeader(String(headerRow[c] ?? ""));
    const fieldKey = HEADER_MAP[normalized];
    if (fieldKey) {
      colMap[fieldKey] = c;
    }
  }

  const rows: ImportRow[] = [];
  const seenSkus = new Set<string>();

  // Process data rows (skip header)
  for (let i = 1; i < rawArrays.length; i++) {
    const cells = rawArrays[i];
    const rowNumber = i + 1; // 1-based Excel row

    const cell = (key: string) => {
      const idx = colMap[key];
      return idx !== undefined ? String(cells[idx] ?? "").trim() : "";
    };

    const rawSku = cell("sku");
    const rawProvDesc = cell("provider_description");
    const rawCustomsDesc = cell("customs_description");
    const rawInternalDesc = cell("internal_description");
    const rawNcm = cell("ncm_code");
    const rawCountry = cell("country_of_origin");
    const rawApertura = colMap["apertura"] !== undefined ? cells[colMap["apertura"]] : "";

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
