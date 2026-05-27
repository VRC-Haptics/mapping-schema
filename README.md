# mapping-schema
Hosts the standards for the mapping schema used throughout this project, as well as the methods for traversing versions.

Please note that the `map.schema.json` is the only guaranteed file for each version. Every other file is defined on an as-required basis.

https://vrc-haptics.github.io/mapping-schema/schema/migrate.d.ts 
Hosts the interfaces for the migration scripts.

# Structure:

- `schema/` contains the actual json schemas.
    - `schema/versions.json` lists all publicly released Semver's of the schema under the `schema-versions` tag.
    - `schema/{version-semvar}/` contains all materials for schemas and sub-schemas.
        - `up.js` Migration script for transforming to the next higher version. (e.g. +1 index in the `versions.json` list)
        - `down.js` Migration script for transforming to the next lower version.
    - `schema/deprecated/` contains migration scripts for retired versions.
        - `{version-semvar}.js` Migrates from the deprecated version to its nearest supported version.
- `src/` contains the web-based migration tool (HTML, CSS, JS).
- `scripts/` contains python scripts used in the workflows to create the `build/` directory.
- `build/` contains the output directory that is published to gh-pages.


## Version Migration
Versions are assumed to fall in the order that they appear in the versions.json file. So index 1 in the `schema-versions` key migrates up to version index 2 and down to index 0.

### Migration Scripts
Version Traversal is performed via the `up.js` and the `down.js` in each version's directory. 

Order of traversal is determined by the `schema-versions` list order in versions.json. `up.js` for a particular version translates to the nearest version above it on the active list and inverse for `down.js`.

For `deprecated-versions`, these are semvar's that have been retired for one reason or another and no longer are recommended or widely supported. Their migration scripts exist under `schema/deprecated/`, but the schemas have been removed to enforce this.

Migration scripts are JavaScript modules that implement the `Migration` interface:

```javascript
export default {
    from: 'v0.0.0',       // source version
    to: 'v0.0.1',         // target version
    requiresUserInput: false, // whether ctx.request() prompts are used

    // Extracts and stashes values from the old document into ctx for later use.
    async gather(old, ctx) { },

    // Creates a NEW object in the target format using values from ctx.
    // Should not mutate the old document.
    async migrate(old, ctx) { }
}
```

The `MigrationCtx` provides:
- `ctx.log(msg)` / `ctx.warn(msg)` — logging
- `ctx.get(key)` / `ctx.set(key, value)` — key-value store shared between `gather` and `migrate`
- `ctx.request(prompt, default_value, key)` — requests user input when `requiresUserInput` is true

**WARNING**: Using `${{BASE_URL}}` will be preprocessed in the same way as the schemas. Purely for migration purposes later.