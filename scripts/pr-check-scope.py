"""Select PR checks from the tested merge commit and its first parent."""

import re
import subprocess
from html.parser import HTMLParser


POPUP = b"extension/popup.html"
STYLES = b"extension/popup.css"
DISCLOSURE = re.compile(
    rb'(<details class="tools" id="key-settings">\s*<summary>)(.*?)(</summary>)',
    re.DOTALL,
)


def git(*args):
    return subprocess.check_output(["git", *args])


class SummaryMarkup(HTMLParser):
    """Allow text and inert inline markup in the settings disclosure."""

    allowed_attributes = {
        "span": {"id", "class", "role", "aria-hidden"},
        "svg": {"class", "aria-hidden", "viewbox", "fill", "stroke", "stroke-width"},
        "path": {"d"},
        "circle": {"cx", "cy", "r"},
    }

    def handle_starttag(self, tag, attrs):
        allowed = self.allowed_attributes.get(tag)
        if allowed is None or any(name not in allowed for name, _ in attrs):
            raise ValueError(f"Unexpected settings disclosure markup: {tag}")

    def handle_endtag(self, tag):
        if tag not in self.allowed_attributes:
            raise ValueError(f"Unexpected settings disclosure closing tag: {tag}")


def check_scope():
    fields = git("diff", "--name-status", "--no-renames", "-z", "HEAD^1", "HEAD", "--").split(b"\0")
    changes = list(zip(fields[::2], fields[1::2]))
    if not changes or any(status != b"M" or path not in {POPUP, STYLES} for status, path in changes):
        return "full"

    if (b"M", POPUP) in changes:
        before = git("show", "HEAD^1:extension/popup.html")
        after = git("show", "HEAD:extension/popup.html")
        old_summary = DISCLOSURE.search(before)
        new_summary = DISCLOSURE.search(after)
        if not old_summary or not new_summary:
            return "full"
        if DISCLOSURE.sub(rb"\1\3", before, count=1) != DISCLOSURE.sub(rb"\1\3", after, count=1):
            return "full"
        markup = SummaryMarkup()
        markup.feed(new_summary[2].decode())
        markup.close()

    return "light"


if __name__ == "__main__":
    try:
        print(check_scope())
    except (subprocess.CalledProcessError, ValueError):
        print("full")
