/* Jira Interno TROBBU v15.6
 * Robust CSV/tabular import helper for Backlog.
 * Supports Google Sheets CSV exports with preamble rows, BOM, accents,
 * non-breaking/zero-width spaces and header aliases without changing
 * the official destination schema.
 */
(function (global) {
  "use strict";

  const REQUIRED_HEADERS = ["Titulo*", "Producto*"];
  const OFFICIAL_HEADERS = [
    "Titulo*", "Producto*", "Descripcion", "Tipo", "Prioridad",
    "Story Points", "Responsable Dev", "Responsable QA",
    "Fecha inicio", "Fecha limite"
  ];

  const PRODUCT_CODES = {
    ADM: "Web Administrativa",
    SOC: "Web Socios",
    APP: "App Socios",
    AUT: "Automatizaciones",
    FIN: "Panel Financiero"
  };

  function stripBom(text) {
    return String(text ?? "").replace(/^\uFEFF/, "");
  }

  function cleanCell(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .replace(/[\u200B-\u200D\u2060]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trim();
  }

  function cleanText(value) {
    return cleanCell(value).replace(/\s+/g, " ");
  }

  function headerKey(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s*\*\s*$/, "*")
      .replace(/\s*:\s*$/, "")
      .replace(/\s+/g, " ");
  }

  const OFFICIAL_BY_KEY = Object.fromEntries(OFFICIAL_HEADERS.map(h => [headerKey(h), h]));
  const HEADER_ALIASES = {
    "titulo": "Titulo*",
    "titulo*": "Titulo*",
    "producto": "Producto*",
    "producto*": "Producto*",
    "descripcion": "Descripcion",
    "tipo": "Tipo",
    "prioridad": "Prioridad",
    "story points": "Story Points",
    "story point": "Story Points",
    "responsable dev": "Responsable Dev",
    "responsable desarrollo": "Responsable Dev",
    "responsable qa": "Responsable QA",
    "fecha inicio": "Fecha inicio",
    "fecha de inicio": "Fecha inicio",
    "fecha limite": "Fecha limite",
    "fecha de limite": "Fecha limite",
    "fecha de entrega": "Fecha limite"
  };

  function canonicalHeader(value) {
    const original = cleanText(value);
    const key = headerKey(original);
    return HEADER_ALIASES[key] || OFFICIAL_BY_KEY[key] || original;
  }

  function detectDelimiter(text) {
    const sample = stripBom(text).split(/\r?\n/).slice(0, 30).join("\n");
    const candidates = [",", ";", "\t"];
    let best = ",";
    let bestScore = -1;

    for (const delimiter of candidates) {
      let score = 0, inQuotes = false;
      for (let i = 0; i < sample.length; i++) {
        const ch = sample[i];
        if (ch === '"') {
          if (inQuotes && sample[i + 1] === '"') i++;
          else inQuotes = !inQuotes;
        } else if (!inQuotes && ch === delimiter) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = delimiter;
      }
    }
    return best;
  }

  function parseCsv(text, delimiter) {
    const src = stripBom(text);
    const sep = delimiter || detectDelimiter(src);
    const rows = [];
    let row = [], field = "", inQuotes = false;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
        continue;
      }
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { row.push(field); field = ""; }
      else if (ch === "\r") {
        if (src[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else if (ch === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else field += ch;
    }

    row.push(field);
    if (row.some(v => String(v).length > 0) || rows.length === 0) rows.push(row);
    return rows;
  }

  function findHeaderRow(rows, maxScanRows) {
    const max = Math.min(Array.isArray(rows) ? rows.length : 0, maxScanRows || 30);
    for (let i = 0; i < max; i++) {
      const canonical = (rows[i] || []).map(canonicalHeader);
      const keys = new Set(canonical.map(headerKey));
      const hasTitle = keys.has(headerKey("Titulo*"));
      const hasProduct = keys.has(headerKey("Producto*"));
      if (hasTitle && hasProduct) return i;
    }
    return -1;
  }

  function rowsToObjects(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      return { headers: [], rawHeaders: [], records: [], headerRowIndex: -1 };
    }
    const headerRowIndex = findHeaderRow(rows);
    if (headerRowIndex < 0) {
      const rawHeaders = (rows[0] || []).map(cleanText);
      return { headers: rawHeaders.map(canonicalHeader), rawHeaders, records: [], headerRowIndex: -1 };
    }

    const rawHeaders = (rows[headerRowIndex] || []).map(cleanText);
    const headers = rawHeaders.map(canonicalHeader);
    const records = rows.slice(headerRowIndex + 1)
      .filter(row => (row || []).some(cell => cleanCell(cell) !== ""))
      .map((row, index) => {
        const obj = { __rowNumber: headerRowIndex + index + 2 };
        headers.forEach((header, col) => {
          if (header) obj[header] = cleanCell((row || [])[col]);
        });
        return obj;
      });
    return { headers, rawHeaders, records, headerRowIndex };
  }

  function validateHeaders(headers) {
    const errors = [];
    const keys = new Set((headers || []).map(headerKey));
    for (const required of REQUIRED_HEADERS) {
      if (!keys.has(headerKey(required))) errors.push(`Falta la columna obligatoria "${required}".`);
    }
    const officialKeys = new Set(OFFICIAL_HEADERS.map(headerKey));
    const unknown = (headers || []).filter(h => h && !officialKeys.has(headerKey(h)));
    return { valid: errors.length === 0, errors, unknown };
  }

  function parseGoogleSheetsCsv(text) {
    const rows = parseCsv(text);
    const converted = rowsToObjects(rows);
    const headerCheck = validateHeaders(converted.headers);
    return {
      source: "csv",
      delimiter: detectDelimiter(text),
      headers: converted.headers,
      rawHeaders: converted.rawHeaders,
      records: converted.records,
      headerRowIndex: converted.headerRowIndex,
      headerCheck,
      productCodes: { ...PRODUCT_CODES }
    };
  }

  async function readFile(file) {
    if (!file) throw new Error("Selecciona un archivo.");
    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".csv")) throw new Error("El archivo seleccionado no es CSV.");
    const text = await file.text();
    return parseGoogleSheetsCsv(text);
  }

  global.TrobbuCsvImport = {
    OFFICIAL_HEADERS,
    REQUIRED_HEADERS,
    PRODUCT_CODES,
    stripBom,
    cleanCell,
    cleanText,
    headerKey,
    canonicalHeader,
    detectDelimiter,
    parseCsv,
    findHeaderRow,
    rowsToObjects,
    validateHeaders,
    parseGoogleSheetsCsv,
    readFile
  };
})(typeof window !== "undefined" ? window : globalThis);
