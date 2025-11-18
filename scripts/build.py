import shutil
from pathlib import Path
from clean import clean
import argparse
import json

build_dir: Path = Path("build")
schema_dir: Path = build_dir.joinpath(Path("schema"))

raw_root: Path = Path("schema")

# Processes a migration file and return the modified string
def process_migrate(contents: str, url: str) -> str:
    return contents.replace("${{BASE_URL}}", url)

def process_version_folder(folder: Path, url: str, is_first: bool, is_last: bool):
    #create version folder at build directory
    out_path = schema_dir.joinpath(folder.name)
    out_path.mkdir()

    #process schemas
    schemas = list(folder.glob("*.schema.json"))
    for schema in schemas:
        content = schema.read_text()
        content = content.replace("${{BASE_URL}}", url)
        content = content.replace("${{VERSION}}", schema.parent.name)
        
        out_file = out_path.joinpath(schema.name)
        out_file.write_text(content)

    #process migration files
    if not is_first: 
        migrate = folder.joinpath("migrate-down.json")
        processed = process_migrate(migrate.read_text(), url)

        out_file = out_path.joinpath("migrate-down.json")
        out_file.write_text(processed)
    else:
        print("Skipped migration-down.json for first version")

    if not is_last:
        migrate = folder.joinpath("migrate-up.json")
        processed = process_migrate(migrate.read_text(), url)

        out_file = out_path.joinpath("migrate-up.json")
        out_file.write_text(processed)
    else:
        print("Skipped migration-up.json for latest version")

def build(url: str):
    # Copy versions list
    version = raw_root.joinpath("versions.json")
    dest = schema_dir.joinpath("versions.json")
    shutil.copy2(version, dest)

    dot = build_dir.joinpath(".nojekyll")
    dot.touch()

    # Process each version
    versions_file = raw_root.joinpath("versions.json")
    version_order = json.loads(versions_file.read_text())["schema-versions"]

    version_dirs = sorted(
        [d for d in raw_root.iterdir() if d.is_dir()],
        key=lambda d: version_order.index(d.name)
    )
    for (idx, version) in enumerate(version_dirs):
        print(f"Processing Version: {version}")
        process_version_folder(version, url, idx == 0, idx == len(version_dirs)-1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True, help='Base URL to mount hosted \'schema\' folder to')
    args = parser.parse_args()

    print("Cleaning Old Build") 
    clean()

    url = args.url
    print(f"Starting Build with url: {url}")
    build(url)

    print("Build Completed")
