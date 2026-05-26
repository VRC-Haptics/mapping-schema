// @ts-check

/**
 * @typedef {{message: string, type: string, length?: number, itemType?: string}} PromptOptions
 * @typedef {{prompt: (opts: PromptOptions) => Promise<unknown>, warn: (msg: string) => void, log: (msg: string) => void}} MigrationContext
 * @typedef {{from: string, to: string, requiresUserInput: boolean, migrate: (old: unknown, ctx: MigrationContext) => Promise<unknown>}} Migration
 */

const SCHEMA_BASE = "https://vrc-haptics.github.io/mapping-schema/schema";
const VERSIONS_URL = `${SCHEMA_BASE}/versions.json`;

/** @type {unknown} */
let currentDoc = null;
/** @type {string} */
let fileVersion = "";
/** @type {string} */
let originalFilename = "";
/** @type {string[]} */
let currentVersions = [];
/** @type {string[]} */
let deprecatedVersions = [];

// ── Elements ──

const fileInput = /** @type {HTMLInputElement} */ (document.getElementById("file-input"));
const uploadStatus = /** @type {HTMLDivElement} */ (document.getElementById("upload-status"));
const stepUpload = /** @type {HTMLDivElement} */ (document.getElementById("step-upload"));
const stepVersion = /** @type {HTMLDivElement} */ (document.getElementById("step-version"));
const stepPrompt = /** @type {HTMLDivElement} */ (document.getElementById("step-prompt"));
const stepResult = /** @type {HTMLDivElement} */ (document.getElementById("step-result"));
const currentVersionEl = /** @type {HTMLParagraphElement} */ (document.getElementById("current-version"));
const versionSelect = /** @type {HTMLSelectElement} */ (document.getElementById("version-select"));
const migrateBtn = /** @type {HTMLButtonElement} */ (document.getElementById("migrate-btn"));
const migrateStatus = /** @type {HTMLDivElement} */ (document.getElementById("migrate-status"));
const promptLabel = /** @type {HTMLLabelElement} */ (document.getElementById("prompt-label"));
const promptInput = /** @type {HTMLInputElement} */ (document.getElementById("prompt-input"));
const promptSubmit = /** @type {HTMLButtonElement} */ (document.getElementById("prompt-submit"));
const promptError = /** @type {HTMLDivElement} */ (document.getElementById("prompt-error"));
const logEl = /** @type {HTMLDivElement} */ (document.getElementById("log"));
const downloadBtn = /** @type {HTMLButtonElement} */ (document.getElementById("download-btn"));

/**
 * Detects the schema version from a parsed document.
 * Falls back to v0.0.0 if missing or invalid.
 * @param {Record<string, unknown>} doc
 * @returns {string}
 */
function detectVersion(doc) {
  const version = doc["schemaVersion"];
  if (typeof version === "string" && /^v\d+\.\d+\.\d+$/.test(version)) {
    return version;
  }
  return "v0.0.0";
}

/**
 * Fetches and parses versions.json, populating allVersions and deprecatedVersions.
 * @returns {Promise<void>}
 */
async function loadVersions() {
  const res = await fetch(VERSIONS_URL);
  if (!res.ok) throw new Error(`Failed to fetch versions.json (${res.status})`);
  const data = await res.json();

  currentVersions = /** @type {string[]} */ (data.schemaVersions || []);
  deprecatedVersions = /** @type {string[]} */ (data.deprecatedVersions || []);
}

/**
 * @param {string} src
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// File Upload

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  originalFilename = file.name;

  try {
    const text = await file.text();
    currentDoc = JSON.parse(text);
  } catch {
    uploadStatus.innerHTML = `<div class="error">Invalid JSON file.</div>`;
    return;
  }

  var doc = /** @type {Record<string, unknown>} */ (currentDoc);
  fileVersion = detectVersion(doc);

  try {
    await loadVersions();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    uploadStatus.innerHTML = `<div class="error">${msg}</div>`;
    return;
  }

  // try to see if version is supported
  if (!currentVersions.includes(fileVersion)) {
    uploadStatus.innerHTML = `<div class="info">File is deprecated format: ${fileVersion}</div>`;
  } else {
    uploadStatus.innerHTML = `<div class="info">File is format: ${fileVersion}</div>`;
  }

  // populate dropdown
  currentVersionEl.textContent = `Current version: ${fileVersion}`;
  versionSelect.innerHTML = "";
  console.log(`currentVersions: ${currentVersions}`);
  for (const v of currentVersions) {
    if (v === fileVersion) continue; // skip current
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = deprecatedVersions.includes(v) ? `${v} (deprecated)` : v;
    versionSelect.appendChild(opt);
  }

  stepVersion.classList.add("active");
  migrateBtn.disabled = false;
});

// ── Migration ──

migrateBtn.addEventListener("click", async () => {
  migrateBtn.disabled = true;
  migrateStatus.innerHTML = "";
  logEl.innerHTML = "";

  const target = versionSelect.value;
  // later
  fileVersion = target;
});

// ── Download ──

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(currentDoc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = originalFilename.replace(/\.json$/, "") + `_${fileVersion}.json`;
  a.click();
  URL.revokeObjectURL(url);
});