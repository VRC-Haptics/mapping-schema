# mapping-schema
Hosts the standards for the mapping schema used throughout this project, as well as the methods for traversing versions.

Please note that the `map.schema.json` is the only garunteed file for each version. Every other file is defined on an as-required basis.

# Structure:

- `schema/` contains the actual json schemas.
    - `schema/versions.json` lists all publicly released Semver's of the schema under the `schema-versions` tag.
    - `schema/{version-semvar}/` contains all materials for schemas and sub-schemas.
        - `migrate-up.json` Records the patching method https://jsonpatch.com/ for transforming to the next higher version. (e.g. +1 index in the `versions.json` list)
        - `migrate-down.json` Patches Downwards in versioning.
- `scripts/` contains python scripts used in the workflows to create the `build/` directory.
- `build/` contains the output directory that is published to gh-pages- 


## Version Migration
Versions are assumed to fall in the order that they appear in the versions.json file. So index 1 in the `schema-versions` key migrates up to version index 2 and down to index 0.

Migration files are a json format that describe what is needed to migrate from one version to another. They use the JSON Pointer specification for referencing value fields within a known json structure.

### Upgrade format.
Here we have an already known format that we need to migrate into a new version.

```jsonc
{
    // whether the requested update is possible in a trivial, automatic way
    // Purely a convenience field.
    "update_type": "data_reduction" | "data_addition" | "reformat", 
    // Produces a list of var's that can be referenced in patches to fill in missing information.
    "user_input": [
        {
            "explanation": "We are migrating from one coordinate system to another, please enter new coordinates."
            // which field length this input should gather, if any. (equivalent to a for_each)
            "itterate_field": null | "/input_nodes" | "/output_nodes",
            // list of structs to map variables in the user prompt to the documents fields.
            "prompt_vars": {"config_name": "/identification/map_name", "input_node_position": "/input_nodes/$index/location"},
            // template that prompts.
            "prompt_template": "$config_name @ $index has position: $input_node_position"
            "var": number |  integer | null | array | object | boolean | string,
            "var_name": "name-used-in-patches_$index", // must include index reference if itterable results.
        }
    ],
    "patches": [
        // regular patch commands
        { "op": "add", "path": "/biscuits/1", "value": { "name": "Ginger Nut" } },
        { "op": "remove", "path": "/biscuits" },
        { "op": "replace", "path": "/biscuits/0/name", "value": "Chocolate Digestive" },
        { "op": "copy", "from": "/biscuits/0", "path": "/best_biscuit" }
        { "op": "move", "from": "/biscuits", "path": "/cookies" }
        { "op": "test", "path": "/best_biscuit/name", "value": "Choco Leibniz" }

        // With the iterate key, during runtime this should be preprocessedfor each value in the itterated address.
        // This will expand into len(input_nodes) add patches, where .
        { "iterate": "/input_nodes", "op": "add", "path": "/input_nodes/$index/location", "value": "name-used-in-patches_$index"}
    ]
}
```

**WARNING**: Using `${{BASE_URL}}` will be preprocessed in the same way as the schemas. Purely for migration purposes later.
