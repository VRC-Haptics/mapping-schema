import shutil
from pathlib import Path

def clean(): 
    build_dir: Path = Path("build")
    schema_dir: Path = build_dir.joinpath(Path("schema"))

    # clear previous build.
    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir(exist_ok=True)
    schema_dir.mkdir(exist_ok=True)
