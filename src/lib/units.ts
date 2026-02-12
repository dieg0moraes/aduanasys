// ============================================
// Códigos de Unidades Comerciales – DUA Uruguay
// Códigos usados en la declaración aduanera.
// ============================================

export interface CommercialUnit {
  code: string; // 3-digit zero-padded
  name: string;
}

export const COMMERCIAL_UNITS: CommercialUnit[] = [
  { code: "002", name: "UNIDAD (C/U)" },
  { code: "003", name: "METRO CUBICO" },
  { code: "005", name: "LITROS" },
  { code: "007", name: "PARES" },
  { code: "008", name: "CAJAS" },
  { code: "018", name: "GALONES" },
  { code: "022", name: "METRO CUADRADO" },
  { code: "023", name: "METRO LINEAL" },
  { code: "082", name: "METROS CUADRADOS" },
];

// Lookup maps
const byCode = new Map(COMMERCIAL_UNITS.map((u) => [u.code, u]));
const byNameLower = new Map(COMMERCIAL_UNITS.map((u) => [u.name.toLowerCase(), u]));

/** Get unit by DUA code */
export function getUnitByCode(code: string): CommercialUnit | undefined {
  return byCode.get(code.padStart(3, "0"));
}

/** Get unit name by code */
export function getUnitName(code: string): string {
  return byCode.get(code.padStart(3, "0"))?.name ?? code;
}

/**
 * Try to match a free-text unit_of_measure to a DUA code.
 * Returns the code if matched, or the original text if not.
 */
export function matchUnitToDUA(unitText: string | null): string {
  if (!unitText) return "";
  const text = unitText.trim();

  // Already a code?
  const padded = text.padStart(3, "0");
  if (byCode.has(padded)) return padded;

  // Exact name match
  const exactMatch = byNameLower.get(text.toLowerCase());
  if (exactMatch) return exactMatch.code;

  // Partial match
  const lower = text.toLowerCase();
  for (const unit of COMMERCIAL_UNITS) {
    if (unit.name.toLowerCase().includes(lower) || lower.includes(unit.name.toLowerCase())) {
      return unit.code;
    }
  }

  // Common aliases
  const aliases: Record<string, string> = {
    "unidad": "002", "unidades": "002", "c/u": "002", "pza": "002", "pieza": "002", "piezas": "002",
    "m3": "003", "m³": "003",
    "litro": "005", "lts": "005", "lt": "005", "l": "005",
    "par": "007",
    "caja": "008",
    "galon": "018", "gal": "018",
    "m2": "022", "m²": "022",
    "metro": "023", "ml": "023", "m": "023",
  };
  const alias = aliases[lower];
  if (alias) return alias;

  return text;
}
