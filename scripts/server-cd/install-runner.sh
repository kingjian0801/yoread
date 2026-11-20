#!/usr/bin/env bash
set -euo pipefail

if [[ $(id -u) != 0 || $# != 1 ]]; then
    printf 'Run as root with a verified Linux x64 Actions Runner archive and a registration token on stdin.\n' >&2
    exit 1
fi

source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
directory=/opt/yoread-actions-runner
account=yoread-runner
repository=https://github.com/kingjian0801/yoread

for executable in curl jq sudo visudo runuser; do
    command -v "$executable" >/dev/null
done
/usr/bin/python3 -I -c 'import jwt'

if ! id "$account" >/dev/null 2>&1; then
    useradd --system --user-group --no-create-home --home-dir "$directory" \
        --shell /usr/sbin/nologin "$account"
fi
install -d -o "$account" -g "$account" -m 0750 "$directory"
install -o root -g root -m 0755 "$source_dir/publish.py" /usr/local/sbin/yoread-publish
install -d -o root -g root -m 0755 /usr/local/lib/yoread-cd
install -o root -g root -m 0755 "$source_dir/allow-runner-job.sh" /usr/local/lib/yoread-cd/allow-runner-job.sh

sudoers=$(mktemp)
trap 'rm -f "$sudoers"' EXIT
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/yoread-publish ""\n' "$account" > "$sudoers"
visudo -cf "$sudoers"
install -o root -g root -m 0440 "$sudoers" /etc/sudoers.d/yoread-runner

cd "$directory"
if [[ ! -x config.sh ]]; then
    runuser -u "$account" -- tar -xzf - < "$1"
fi
if [[ ! -f .runner ]]; then
    read -rs -p 'GitHub Runner token: ' registration_token
    if [[ -t 0 ]]; then printf '\n'; fi
    runuser -u "$account" -- ./config.sh --unattended --url "$repository" \
        --token "$registration_token" --name yoread-production --labels yoread-production
    unset registration_token
fi
cat > /etc/systemd/system/yoread-actions-runner.service <<'UNIT'
[Unit]
Description=Yoread GitHub Actions production runner
Wants=network-online.target
After=network-online.target

[Service]
User=yoread-runner
Group=yoread-runner
WorkingDirectory=/opt/yoread-actions-runner
Environment=ACTIONS_RUNNER_HOOK_JOB_STARTED=/usr/local/lib/yoread-cd/allow-runner-job.sh
ExecStart=/opt/yoread-actions-runner/bin/runsvc.sh
Restart=on-failure
RestartSec=10s
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/opt/yoread-actions-runner /root/kim_workspace/yoread
ReadWritePaths=-/run/sudo
InaccessiblePaths=-/run/docker.sock

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable yoread-actions-runner.service
systemctl restart yoread-actions-runner.service
