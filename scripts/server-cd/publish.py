#!/usr/bin/python3 -I
"""Verify a Yoread Actions deployment and atomically install its tested artifact."""

import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import sys
import tempfile
from urllib.request import Request, urlopen
from zipfile import ZipFile, is_zipfile

import jwt


REPOSITORY = "kingjian0801/yoread"
REPOSITORY_ID = "1462882944"
OWNER_ID = "24697783"
SUBJECT = f"repo:kingjian0801@{OWNER_ID}/yoread@{REPOSITORY_ID}:environment:production"
ISSUER = "https://token.actions.githubusercontent.com"
AUDIENCE = "yoread-production"
API = f"https://api.github.com/repos/{REPOSITORY}"
EVENTS = {"push", "workflow_dispatch"}
REVISION = r"[0-9a-f]{40}"
LIMIT = 32 * 1024 * 1024
TRIAL = "yoread-chrome-trial.zip"
SOURCE = "yoread-source.zip"
WORKSPACE = Path("/root/kim_workspace/yoread")
REQUIRED = {
    SOURCE,
    "extension/manifest.json", "extension/LICENSE", "extension/LICENSE-MIT-ORIGINAL",
}


def github(path):
    request = Request(API + path, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "yoread-server-cd",
    })
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def verify_job(token):
    keys = jwt.PyJWKClient(f"{ISSUER}/.well-known/jwks", timeout=15)
    key = keys.get_signing_key_from_jwt(token)
    claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=AUDIENCE, issuer=ISSUER,
                        options={"require": ["exp", "iat", "nbf", "sub"]})
    expected_claims = {
        "repository": REPOSITORY,
        "repository_id": REPOSITORY_ID,
        "repository_owner_id": OWNER_ID,
        "ref": "refs/heads/main",
        "workflow_ref": f"{REPOSITORY}/.github/workflows/ci.yml@refs/heads/main",
        "sub": SUBJECT,
        "runner_environment": "self-hosted",
    }
    mismatches = [name for name, value in expected_claims.items() if claims.get(name) != value]
    if mismatches:
        raise ValueError("The job is outside the allowed Yoread deployment workflow: " + ", ".join(mismatches))
    revision = claims["sha"]
    run_id = claims["run_id"]
    if claims["event_name"] not in EVENTS or not re.fullmatch(REVISION, revision) or not re.fullmatch(r"[0-9]+", run_id):
        raise ValueError("The job is outside the allowed workflow event, revision or run")

    # A deploy-only retry reuses successful checks from an earlier attempt of this run.
    jobs = github(f"/actions/runs/{run_id}/jobs?filter=all&per_page=100")["jobs"]
    checks = [job for job in jobs if job["name"] == "Repository checks"]
    if not checks or max(checks, key=lambda job: job["id"])["conclusion"] != "success":
        raise ValueError("The deployment run has no successful Repository checks")

    artifacts = github(f"/actions/runs/{run_id}/artifacts?name=yoread-chrome-trial")["artifacts"]
    if len(artifacts) != 1 or artifacts[0]["expired"]:
        raise ValueError("The deployment run has no unique, active Chrome trial artifact")
    digest = artifacts[0]["digest"]
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise ValueError("The deployment artifact has no SHA-256 digest")
    return revision, run_id, digest


def unpack(stage, revision, run_id, payload):
    trial = stage / TRIAL
    trial.write_bytes(payload)
    with ZipFile(trial) as archive:
        entries = archive.infolist()
        if len(entries) > 2000 or sum(entry.file_size for entry in entries) > LIMIT:
            raise ValueError("Expanded release is too large")
        names = set()
        for entry in entries:
            name = entry.filename.removesuffix("/")
            path = PurePosixPath(name)
            directory = entry.is_dir()
            allowed = name.startswith("extension/") or name == ("extension" if directory else SOURCE)
            mode = stat.S_IFDIR if directory else stat.S_IFREG
            if (not allowed or stat.S_IFMT(entry.external_attr >> 16) not in (0, mode) or "\\" in name
                    or str(path) != name or ".." in path.parts or name in names):
                raise ValueError(f"Unexpected release entry: {name}")
            names.add(name)
            if directory:
                continue
            target = stage.joinpath(*path.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, target.open("xb") as output:
                shutil.copyfileobj(source, output)

    if not REQUIRED <= names or not is_zipfile(stage / SOURCE):
        raise ValueError("Release is missing required files or a valid source archive")
    manifest = json.loads((stage / "extension/manifest.json").read_text())
    for filename in (manifest["action"]["default_popup"], manifest["background"]["service_worker"]):
        if f"extension/{filename}" not in names or not (stage / "extension" / filename).is_file():
            raise ValueError(f"Missing extension file: {filename}")
    metadata = {"revision": revision, "branch": "main", "version": manifest["version"], "run_id": run_id}
    (stage / "deployment.json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def deploy(directory, revision, run_id, payload):
    relative = Path("releases/actions") / revision
    destination = directory / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    current = directory / "current"
    with tempfile.TemporaryDirectory(prefix=".push-", dir=directory) as temporary:
        stage = Path(temporary) / "release"
        stage.mkdir()
        metadata = unpack(stage, revision, run_id, payload)
        with (directory / ".deploy.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            if github("/git/ref/heads/main")["object"]["sha"] != revision:
                print(f"main has advanced. Skipping deployment of {revision}.")
                return
            if current.is_symlink():
                previous = os.readlink(current)
                if not re.fullmatch(r"releases/(actions/)?" + REVISION, previous):
                    raise ValueError(f"Refusing to replace an unmanaged link: {current}")
            elif current.exists():
                raise ValueError(f"Refusing to replace an existing directory or file: {current}")

            if not destination.exists():
                stage.rename(destination)
            else:
                # Keep the original release immutable when retrying the same commit.
                metadata = json.loads((destination / "deployment.json").read_text())
                if metadata["revision"] != revision:
                    raise ValueError(f"Unexpected metadata in {destination}")
            link = Path(temporary) / "current"
            link.symlink_to(relative, target_is_directory=True)
            os.replace(link, current)
        print(f"Deployed Yoread {metadata['version']} ({revision}) from Actions run "
              f"{metadata['run_id']} at {current}")


if __name__ == "__main__":
    token_line = sys.stdin.buffer.readline(16_384)
    if not token_line.endswith(b"\n"):
        sys.exit("Missing or invalid Actions identity")
    revision, run_id, digest = verify_job(token_line.strip().decode("ascii"))
    payload = sys.stdin.buffer.read(LIMIT + 1)
    if len(payload) > LIMIT or f"sha256:{hashlib.sha256(payload).hexdigest()}" != digest:
        sys.exit("Release archive does not match the GitHub artifact")
    deploy(WORKSPACE, revision, run_id, payload)
