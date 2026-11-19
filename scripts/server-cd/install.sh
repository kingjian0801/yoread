#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) != 0 ]]; then
    printf 'Run this installer as root.\n' >&2
    exit 1
fi

source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
directory=/root/kim_workspace/yoread
library=/usr/local/lib/yoread-cd

if [[ -L "$directory" ]]; then
    printf 'Refusing to install into an existing symlink: %s\n' "$directory" >&2
    exit 1
fi

for executable in git python3 systemctl systemd-analyze; do
    command -v "$executable" >/dev/null
done

install -d -m 0755 "$directory" "$library"
install -m 0644 "$source_dir/deploy.py" "$library/deploy.py"
systemd-analyze verify "$source_dir/yoread-deploy.service" "$source_dir/yoread-deploy.timer"
install -m 0644 "$source_dir/yoread-deploy.service" "$source_dir/yoread-deploy.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now yoread-deploy.timer
systemctl start yoread-deploy.service
