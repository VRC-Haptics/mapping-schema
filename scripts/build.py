import shutil
from pathlib import Path
from clean import clean
import argparse
import json
import re
import sys

build_dir: Path = Path("build")
schema_dir: Path = build_dir / "schema"
raw_root: Path = Path("schema")


def extract_migration_field(content: str, field: str) -> str | None:
    match = re.search(rf'{field}\s*:\s*["\']([^"\']+)["\']', content)
    return match.group(1) if match else None

def verify_migrations(active: list[str], deprecated: list[str]):
    active_set = set(active)
    deprecated_dir = raw_root / "deprecated"

    # all deprecated .js files must point to a non-deprecated version
    for ver in deprecated:
        js_file = deprecated_dir / f"{ver}.js"
        if not js_file.exists():
            sys.exit(f"ERROR: Missing deprecated migration file: {js_file}")
        content = js_file.read_text()
        to_ver = extract_migration_field(content, "to")
        if to_ver is None:
            sys.exit(f"ERROR: Could not parse 'to' field in {js_file}")
        if to_ver not in active_set:
            sys.exit(f"ERROR: {js_file} targets '{to_ver}' which is not an active version")

    # all non-deprecated up.js/down.js must point to adjacent versions
    for idx, ver in enumerate(active):
        ver_dir = raw_root / ver

        if idx < len(active) - 1:
            up_file = ver_dir / "up.js"
            if not up_file.exists():
                sys.exit(f"ERROR: Missing {up_file}")
            content = up_file.read_text()
            from_ver = extract_migration_field(content, "from")
            to_ver = extract_migration_field(content, "to")
            if from_ver != ver:
                sys.exit(f"ERROR: {up_file} 'from' is '{from_ver}', expected '{ver}'")
            if to_ver != active[idx + 1]:
                sys.exit(f"ERROR: {up_file} 'to' is '{to_ver}', expected '{active[idx + 1]}'")

        if idx > 0:
            down_file = ver_dir / "down.js"
            if not down_file.exists():
                sys.exit(f"ERROR: Missing {down_file}")
            content = down_file.read_text()
            from_ver = extract_migration_field(content, "from")
            to_ver = extract_migration_field(content, "to")
            if from_ver != ver:
                sys.exit(f"ERROR: {down_file} 'from' is '{from_ver}', expected '{ver}'")
            if to_ver != active[idx - 1]:
                sys.exit(f"ERROR: {down_file} 'to' is '{to_ver}', expected '{active[idx - 1]}'")

def process_schemas(folder: Path, out_path: Path, url: str):
    for schema in folder.glob("*.schema.json"):
        content = schema.read_text()
        content = content.replace("${{BASE_URL}}", url)
        content = content.replace("${{VERSION}}", folder.name)
        (out_path / schema.name).write_text(content)


def process_version_folder(folder: Path, url: str, is_first: bool, is_last: bool):
    out_path = schema_dir / folder.name
    out_path.mkdir()

    process_schemas(folder, out_path, url)

    if not is_first:
        shutil.copy2(folder / "down.js", out_path / "down.js")
    else:
        print("Skipped down.js for first version")

    if not is_last:
        shutil.copy2(folder / "up.js", out_path / "up.js")
    else:
        print("Skipped up.js for latest version")

def process_deprecated(deprecated_versions: list[str]):
    deprecated_out = schema_dir / "deprecated"
    deprecated_out.mkdir()

    for ver in deprecated_versions:
        print(f"Processing Deprecated Version: {ver}")
        src = raw_root / "deprecated" / f"{ver}.js"
        shutil.copy2(src, deprecated_out / f"{ver}.js")

def build(url: str):
    versions_file = raw_root / "versions.json"
    versions_data = json.loads(versions_file.read_text())
    active_versions = versions_data["schemaVersions"]
    deprecated_versions = versions_data.get("deprecatedVersions", [])

    print("Verifying migrations...")
    verify_migrations(active_versions, deprecated_versions)
    print("Migrations verified.")

    # Copy versions.json and migrate.d.ts
    shutil.copy2(versions_file, schema_dir / "versions.json")
    shutil.copy2(raw_root / "migrate.d.ts", schema_dir / "migrate.d.ts")

    (build_dir / ".nojekyll").touch()

    # Process active versions
    for idx, ver in enumerate(active_versions):
        ver_dir = raw_root / ver
        print(f"Processing Version: {ver_dir}")
        process_version_folder(ver_dir, url, idx == 0, idx == len(active_versions) - 1)

    # Process deprecated versions
    process_deprecated(deprecated_versions)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True, help="Base URL to mount hosted 'schema' folder to")
    args = parser.parse_args()

    print("Cleaning Old Build")
    clean()

    print(f"Starting Build with url: {args.url}")
    build(args.url)

    print("Build Completed")