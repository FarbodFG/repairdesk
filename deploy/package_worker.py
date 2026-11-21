"""Build a source-only Worker ZIP for the ParsPack Docker upload flow."""

import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


PACKAGES = (
    "accounts", "api", "customers", "devices", "notifications",
    "repair_desk", "repairs", "shops", "utils",
)


def build_package(root: Path, output: Path) -> dict[str, object]:
    files = {}
    for package in PACKAGES:
        for source in (root / package).rglob("*.py"):
            if source.is_symlink() or not source.resolve().is_relative_to(root):
                raise ValueError(f"Unsafe package source: {source}")
            files[source.relative_to(root).as_posix()] = source.read_bytes()
    for name in ("manage.py", "requirements.txt", ".dockerignore"):
        files[name] = (root / name).read_bytes()
    files["Dockerfile"] = (root / "deploy/Dockerfile.worker").read_bytes()
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            entry = ZipInfo(name)
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    with ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError("Worker package failed integrity verification.")
        if any(archive.read(name) != data for name, data in files.items()):
            raise ValueError("Worker package differs from the source files.")
    return {
        "path": str(output), "files": len(files), "bytes": output.stat().st_size,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build_package(Path(__file__).resolve().parent.parent, args.output.resolve())))
