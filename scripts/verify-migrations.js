const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const schemaDir = path.join(projectRoot, "schema");
const versionsData = JSON.parse(
  fs.readFileSync(path.join(schemaDir, "versions.json"), "utf-8")
);
const active = versionsData.schemaVersions;
const deprecated = versionsData.deprecatedVersions ?? [];

// Parse Migration interface from migrate.d.ts
function parseMigrationInterface(dtsPath) {
  const content = fs.readFileSync(dtsPath, "utf-8");
  const match = content.match(
    /export\s+interface\s+Migration\s*\{([\s\S]*?)\n\}/
  );
  if (!match) {
    console.error("Could not find 'export interface Migration' in " + dtsPath);
    process.exit(1);
  }

  const body = match[1];
  const fields = [];

  for (const line of body.split("\n")) {
    const trimmed = line.replace(/\/\/.*/, "").trim();
    if (!trimmed || trimmed === "{" || trimmed === "}") continue;

    // Method: async? name(...)
    const methodMatch = trimmed.match(
      /^(?:async\s+)?(\w+)\s*\(/
    );
    if (methodMatch) {
      fields.push({ name: methodMatch[1], kind: "function" });
      continue;
    }

    // Property: name: type
    const propMatch = trimmed.match(
      /^(\w+)\s*:\s*(\w+)/
    );
    if (propMatch) {
      fields.push({ name: propMatch[1], kind: propMatch[2] });
    }
  }

  return fields;
}

const dtsPath = path.join(schemaDir, "migrate.d.ts");
const migrationFields = parseMigrationInterface(dtsPath);

let failed = false;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  failed = true;
}

function checkMigrationShape(mod, filePath) {
  for (const field of migrationFields) {
    if (!(field.name in mod)) {
      fail(`${filePath} is missing export '${field.name}'`);
      continue;
    }
    const actual = typeof mod[field.name];
    if (field.kind === "function") {
      if (actual !== "function")
        fail(`${filePath} '${field.name}' is '${actual}', expected 'function'`);
    } else {
      // Map TS type names to JS typeof results
      const tsToJs = { string: "string", boolean: "boolean", number: "number" };
      const expected = tsToJs[field.kind];
      if (expected && actual !== expected)
        fail(`${filePath} '${field.name}' is '${actual}', expected '${expected}'`);
    }
  }
}

function loadMigration(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`File not found: ${filePath}`);
    return null;
  }
  try {
    const mod = require(filePath);
    return mod.default ?? mod;
  } catch (e) {
    fail(`Failed to load ${filePath}: ${e.message}`);
    return null;
  }
}

// Check deprecated migrations
const activeSet = new Set(active);
for (const ver of deprecated) {
  const filePath = path.join(schemaDir, "deprecated", `${ver}.js`);
  const mod = loadMigration(filePath);
  if (!mod) continue;

  checkMigrationShape(mod, filePath);

  if (mod.from !== ver) {
    fail(`${filePath} 'from' is '${mod.from}', expected '${ver}'`);
  }
  if (!activeSet.has(mod.to)) {
    fail(`${filePath} 'to' is '${mod.to}', which is not an active version`);
  }
}

// Check active version migrations
for (let i = 0; i < active.length; i++) {
  const ver = active[i];

  if (i < active.length - 1) {
    const filePath = path.join(schemaDir, ver, "up.js");
    const mod = loadMigration(filePath);
    if (mod) {
      checkMigrationShape(mod, filePath);
      if (mod.from !== ver)
        fail(`${filePath} 'from' is '${mod.from}', expected '${ver}'`);
      if (mod.to !== active[i + 1])
        fail(`${filePath} 'to' is '${mod.to}', expected '${active[i + 1]}'`);
    }
  }

  if (i > 0) {
    const filePath = path.join(schemaDir, ver, "down.js");
    const mod = loadMigration(filePath);
    if (mod) {
      checkMigrationShape(mod, filePath);
      if (mod.from !== ver)
        fail(`${filePath} 'from' is '${mod.from}', expected '${ver}'`);
      if (mod.to !== active[i - 1])
        fail(`${filePath} 'to' is '${mod.to}', expected '${active[i - 1]}'`);
    }
  }
}

if (failed) {
  console.error("\nVerification FAILED.");
  process.exit(1);
} else {
  console.log("All migrations verified.");
}