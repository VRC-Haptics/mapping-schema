// @ts-check

/**
 * @typedef {string | number | boolean | null | Array<*> | Object<string, *>} Json
 * @typedef {{[key: string]: Json}} JsonObject
 * @typedef {{
 *   log: (msg: string) => void,
 *   warn: (msg: string) => void,
 *   get: (val: string) => unknown,
 *   set: (key: string, value: unknown) => void,
 *   request: (prompt: string, default_value: Json | null, key: string) => Json
 * }} MigrationCtx
 * @typedef {{
 *   from: string,
 *   to: string,
 *   requiresUserInput: boolean,
 *   gather: (old: JsonObject, ctx: MigrationCtx) => Promise<void>,
 *   migrate: (old: JsonObject, ctx: MigrationCtx) => Promise<JsonObject>
 * }} Migration
 */

const SCHEMA_BASE = "https://vrc-haptics.github.io/mapping-schema/schema";
const VERSIONS_URL = `${SCHEMA_BASE}/versions.json`;

/** @type {JsonObject} */
let currentDoc = {};
/** @type {string} */
let fileVersion = "";
/** @type {{vers: string, idx: number} | null} */
let selectedVersion = null;
/** @type {string} */
let originalFilename = "";
/** @type {string[]} */
let currentVersions = [];
/** @type {string[]} */
let deprecatedVersions = [];

// ── Elements ──

const fileInput = /** @type {HTMLInputElement} */ (
  document.getElementById("file-input")
);
const uploadStatus = /** @type {HTMLDivElement} */ (
  document.getElementById("upload-status")
);
const stepUpload = /** @type {HTMLDivElement} */ (
  document.getElementById("step-upload")
);
const stepVersion = /** @type {HTMLDivElement} */ (
  document.getElementById("step-version")
);
const stepPrompt = /** @type {HTMLDivElement} */ (
  document.getElementById("step-prompt")
);
const stepResult = /** @type {HTMLDivElement} */ (
  document.getElementById("step-result")
);
const currentVersionEl = /** @type {HTMLParagraphElement} */ (
  document.getElementById("current-version")
);
const versionSelect = /** @type {HTMLSelectElement} */ (
  document.getElementById("version-select")
);
const migrateBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById("migrate-btn")
);
const migrateStatus = /** @type {HTMLDivElement} */ (
  document.getElementById("migrate-status")
);
const promptLabel = /** @type {HTMLLabelElement} */ (
  document.getElementById("prompt-label")
);
const promptInput = /** @type {HTMLInputElement} */ (
  document.getElementById("prompt-input")
);
const promptSubmit = /** @type {HTMLButtonElement} */ (
  document.getElementById("prompt-submit")
);
const promptError = /** @type {HTMLDivElement} */ (
  document.getElementById("prompt-error")
);
const logEl = /** @type {HTMLDivElement} */ (document.getElementById("log"));
const downloadBtn = /** @type {HTMLButtonElement} */ (
  document.getElementById("download-btn")
);

/**
 * Detects the schema version from a parsed document.
 * Falls back to v0.0.0 if missing or invalid.
 * @param {JsonObject} doc
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
 * @param {string} url
 * @returns {Promise<Migration>}
 */
async function loadMigration(url) {
  const module = await import(url);
  return module.default ?? module;
}

/**
 * Loads a migration module from a URL, runs gather, waits for user input if needed, then migrates.
 *
 * @param {Migration} migration - URL to the migration .js file
 * @param {JsonObject} doc - The document to migrate
 * @param {MigrationCtx} ctx - Migration context
 * @param {() => Promise<void>} waitForUser - Called after gather if requiresUserInput is true.
 *   Should resolve once the user has filled out all requested values.
 * @returns {Promise<JsonObject>} The migrated document
 */
async function runMigration(migration, doc, ctx, waitForUser) {
  await migration.gather(doc, ctx);

  if (migration.requiresUserInput) {
    await waitForUser();
  }

  return await migration.migrate(doc, ctx);
}

/**
 * @returns {{ ctx: MigrationCtx, store: Map<string, unknown>, prompts: Array<{prompt: string, default_value: Json | null, key: string}> }}
 */
function createMigrationCtx() {
  const store = new Map();
  /** @type {Array<{prompt: string, default_value: Json | null, key: string}>} */
  const prompts = [];

  /** @type {MigrationCtx} */
  const ctx = {
    log: (msg) => console.log(`[migration] ${msg}`),
    warn: (msg) => console.warn(`[migration] ${msg}`),
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
    request: (prompt, default_value, key) => {
      prompts.push({ prompt, default_value, key });
      return default_value;
    },
  };

  return { ctx, store, prompts };
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

  fileVersion = detectVersion(currentDoc);

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

async function return_immediately() {};

migrateBtn.addEventListener("click", async () => {
  migrateBtn.disabled = true;
  migrateStatus.innerHTML = "";
  logEl.innerHTML = "";

  selectedVersion = {vers: versionSelect.value, idx: currentVersions.findIndex((s) => s===versionSelect.value)};
  console.log(`Starting migration to: ${selectedVersion}`);

  // move to supported version
  if (!currentVersions.includes(fileVersion)) {
    console.log("Moving to supported version.");

    const {ctx, store, prompts} = createMigrationCtx();
    const url = `${SCHEMA_BASE}/deprecated/${fileVersion}.js`;
    const migration = await loadMigration(url);
    const dest = migration.to;
    console.log(`This will migrate from ${migration.from} to ${migration.to}`);
    currentDoc = await runMigration(
      migration, currentDoc, ctx, return_immediately
    )
    fileVersion = dest;
  } 

  // return early if needed
  if (selectedVersion.vers === fileVersion) return;

  // traverse supported versions
  const targetIdx = selectedVersion.idx;
  const currentIdx = currentVersions.indexOf(fileVersion);
  const step = targetIdx > currentIdx ? 1 : -1;

  for (let i = currentIdx; i !== targetIdx; i += step) {
    const ver = currentVersions[i];
    const direction = step > 0 ? "up" : "down";
    const url = `${SCHEMA_BASE}/${ver}/${direction}.js`;
    const migration = await loadMigration(url);

    const { ctx, store, prompts } = createMigrationCtx();
    currentDoc = await runMigration(migration, currentDoc, ctx, return_immediately);
    fileVersion = currentVersions[i + step];
  }
});

// ── Download ──

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(currentDoc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = originalFilename.replace(/\.json$/, "") + `_${fileVersion}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
