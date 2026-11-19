#!/usr/bin/env python3
"""Publish Yoread from the protected main branch into the server workspace."""

import fcntl
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


REPOSITORY = "https://github.com/kingjian0801/yoread.git"
MAIN = "refs/heads/main"
SOURCE_PREFIX = "yoread-source/"
LICENSES = ("LICENSE", "LICENSE-MIT-ORIGINAL")
REVISION = re.compile(r"[0-9a-f]{40}")


def git(*args, stdout=None):
    return subprocess.run(
        ["git", *args], check=True, stdout=stdout,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )


def fetch_main(cache):
    if not cache.exists():
        git("init", "--bare", "--quiet", str(cache))
    git("-C", str(cache), "fetch", "--quiet", "--depth=1", "--no-tags", REPOSITORY, MAIN)
    revision = git("-C", str(cache), "rev-parse", "FETCH_HEAD^{commit}", stdout=subprocess.PIPE)
    return revision.stdout.decode("ascii").strip()


def pack(cache, stage, revision):
    source = stage / "yoread-source.zip"
    with source.open("wb") as archive:
        git("-C", str(cache), "archive", "--format=zip", "--prefix=" + SOURCE_PREFIX,
            revision, stdout=archive)

    extension = stage / "extension"
    extension.mkdir()
    with ZipFile(source) as archive:
        for entry in archive.infolist():
            prefix = SOURCE_PREFIX + "extension/"
            if not entry.filename.startswith(prefix) or entry.is_dir():
                continue
            relative = PurePosixPath(entry.filename.removeprefix(prefix))
            if relative.is_absolute() or ".." in relative.parts or stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError(f"Unexpected extension archive entry: {entry.filename}")
            path = extension.joinpath(*relative.parts)
            path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as content, path.open("xb") as output:
                shutil.copyfileobj(content, output)
        for name in LICENSES:
            (extension / name).write_bytes(archive.read(SOURCE_PREFIX + name))

    manifest = json.loads((extension / "manifest.json").read_text())
    for name in (manifest["action"]["default_popup"], manifest["background"]["service_worker"]):
        if not (extension / name).is_file():
            raise ValueError(f"Missing extension file: {name}")
    metadata = {"revision": revision, "branch": "main", "version": manifest["version"]}
    (stage / "deployment.json").write_text(json.dumps(metadata, indent=2) + "\n")
    with ZipFile(stage / "yoread-chrome-trial.zip", "w", compression=ZIP_DEFLATED) as trial:
        for path in sorted(extension.rglob("*")):
            if path.is_file():
                trial.write(path, path.relative_to(stage))
        trial.write(source, source.name)
    return metadata


def deploy(directory):
    directory.mkdir(parents=True, exist_ok=True)
    releases = directory / "releases"
    releases.mkdir(exist_ok=True)
    current = directory / "current"
    with (directory / ".deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if current.is_symlink():
            previous = Path(os.readlink(current))
            if previous.parent != Path("releases") or not REVISION.fullmatch(previous.name):
                raise ValueError(f"Refusing to replace an unmanaged link: {current}")
        elif current.exists():
            raise ValueError(f"Refusing to replace an existing directory or file: {current}")

        cache = directory / ".source.git"
        revision = fetch_main(cache)
        if not REVISION.fullmatch(revision):
            raise ValueError(f"Unexpected main revision: {revision}")
        relative = Path("releases") / revision
        destination = directory / relative
        if current.is_symlink() and Path(os.readlink(current)) == relative and destination.is_dir():
            print(f"Already deployed: {revision}")
            return

        with tempfile.TemporaryDirectory(prefix=".deploy-", dir=directory) as temporary:
            stage = Path(temporary) / "release"
            if not destination.exists():
                stage.mkdir()
                pack(cache, stage, revision)
                stage.rename(destination)
            metadata = json.loads((destination / "deployment.json").read_text())
            if metadata["revision"] != revision:
                raise ValueError(f"Unexpected metadata in {destination}")
            link = Path(temporary) / "current"
            link.symlink_to(relative, target_is_directory=True)
            os.replace(link, current)
        print(f"Deployed Yoread {metadata['version']} ({revision}) at {current}")


if __name__ == "__main__":
    deploy(Path(sys.argv[1]))
