"""Validate the repository's Matt workflow bundle without third-party packages."""

import json
from pathlib import Path, PurePosixPath
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check():
    required = (
        "AGENTS.md", "README.md", "docs/agents/issue-tracker.md",
        "docs/agents/domain.md", "docs/agents/triage-labels.md",
        "docs/agents/matt-workflow/NOTICE.md",
        "docs/agents/matt-workflow/mattpocock-MIT.txt",
    )
    for name in required:
        path = ROOT / name
        require(path.is_file() and path.read_text(encoding="utf-8").strip(),
                f"Missing or empty required file: {name}")

    manifest = json.loads(
        (ROOT / "docs/agents/matt-workflow/version.json").read_text(encoding="utf-8")
    )["matt"]
    require(manifest["repository"] == "https://github.com/mattpocock/skills",
            "Unexpected Matt source repository")
    require(re.fullmatch(r"[0-9a-f]{40}", manifest["commit"]),
            "Matt revision must be a full commit SHA")
    paths = manifest["skill_paths"]
    require(isinstance(paths, list) and paths, "skill_paths must be a non-empty list")
    names = [PurePosixPath(path).name for path in paths]
    require(len(set(names)) == len(names), "Duplicate skills in version.json")
    expected = set(names) | {"engineering-workflow"}
    skills = ROOT / ".agents/skills"
    actual = {path.name for path in skills.iterdir() if path.is_dir()}
    require(actual == expected,
            f"Skill directories differ from manifest: missing={sorted(expected - actual)}, "
            f"unexpected={sorted(actual - expected)}")
    for name in sorted(expected):
        path = skills / name / "SKILL.md"
        text = path.read_text(encoding="utf-8")
        require(text.startswith("---\n") and "\n---\n" in text[4:],
                f"Missing skill metadata: {path.relative_to(ROOT)}")
        metadata = text.split("---\n", 2)[1]
        require(re.search(rf"^name: *{re.escape(name)} *$", metadata, re.MULTILINE),
                f"Skill name mismatch: {path.relative_to(ROOT)}")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for link in re.findall(r"\[[^\]]+\]\(([^)]+)\)", readme):
        url = urlsplit(link)
        if not url.scheme and not url.netloc and url.path:
            target = ROOT / unquote(url.path)
            require(target.exists(), f"Broken README link: {link}")

    rules = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for marker in ("<!-- matt-workflow:begin -->", "<!-- matt-workflow:end -->"):
        require(rules.count(marker) == 1, f"Expected one AGENTS.md marker: {marker}")
    require(".agents/skills/engineering-workflow/SKILL.md" in rules,
            "AGENTS.md must reference the workflow entry")
    print(f"OK: {len(expected)} skills, source revision, required files and README links")


if __name__ == "__main__":
    try:
        check()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
