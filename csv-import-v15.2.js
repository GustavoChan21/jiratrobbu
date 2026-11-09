/* Jira Interno TROBBU v15.2
 * CSV import helper for Backlog.
 * Designed to be wired into the existing v15.1 Excel import flow.
 * No external dependency.
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

  function detectDelimiter(text) {
    const sample = stripBom(text).split(/\r?\n/).slice(0, 8).join("\n");
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
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        row.push(field);
        field = "";
      } else if (ch === "\r") {
        if (src[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }

    row.push(field);
    if (row.some(v => String(v).length > 0) || rows.length === 0) rows.push(row);

    return rows;
  }

  function normalizeHeader(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function rowsToObjects(rows) {
    if (!Array.isArray(rows) || !rows.length) {
      return { headers: [], records: [] };
    }
    const headers = rows[0].map(normalizeHeader);
    const records = rows.slice(1)
      .filter(row => row.some(cell => String(cell ?? "").trim() !== ""))
      .map((row, index) => {
        const obj = { __rowNumber: index + 2 };
        headers.forEach((header, col) => {
          if (header) obj[header] = String(row[col] ?? "").trim();
        });
        return obj;
      });
    return { headers, records };
  }

  function validateHeaders(headers) {
    const errors = [];
    for (const required of REQUIRED_HEADERS) {
      if (!headers.includes(required)) errors.push(`Falta la columna obligatoria "${required}".`);
    }
    const unknown = headers.filter(h => h && !OFFICIAL_HEADERS.includes(h));
    return { valid: errors.length === 0, errors, unknown };
  }

  function parseGoogleSheetsCsv(text) {
    const rows = parseCsv(text);
    const { headers, records } = rowsToObjects(rows);
    const headerCheck = validateHeaders(headers);
    return {
      source: "csv",
      delimiter: detectDelimiter(text),
      headers,
      records,
      headerCheck,
      productCodes: { ...PRODUCT_CODES }
    };
  }

  async function readFile(file) {
    if (!file) throw new Error("Selecciona un archivo.");
    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".csv")) {
      throw new Error("El archivo seleccionado no es CSV.");
    }
    const text = await file.text();
    return parseGoogleSheetsCsv(text);
  }

  global.TrobbuCsvImport = {
    OFFICIAL_HEADERS,
    REQUIRED_HEADERS,
    PRODUCT_CODES,
    stripBom,
    detectDelimiter,
    parseCsv,
    rowsToObjects,
    validateHeaders,
    parseGoogleSheetsCsv,
    readFile
  };
})(typeof window !== "undefined" ? window : globalThis);
