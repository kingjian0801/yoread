#!/usr/bin/env bash
set -eu

if [[ ${GITHUB_REPOSITORY:-} == kingjian0801/yoread &&
      ${GITHUB_WORKFLOW_REF:-} == kingjian0801/yoread/.github/workflows/ci.yml@refs/heads/main &&
      ${GITHUB_REF:-} == refs/heads/main &&
      ${GITHUB_JOB:-} == deploy &&
      ( ${GITHUB_EVENT_NAME:-} == push || ${GITHUB_EVENT_NAME:-} == workflow_dispatch ) ]]; then
    exit 0
fi
printf '::error::This runner accepts the Yoread main deployment job only.\n'
exit 1
