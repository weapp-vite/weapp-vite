#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_PATH:?GITHUB_PATH is required}"

source "${BASH_SOURCE[0]%/*}/release-timeout.sh"
release_timeout_path="$(resolve_release_timeout)"
case "$release_timeout_path" in
  /*) ;;
  *) release_timeout_path="$PWD/$release_timeout_path" ;;
esac
release_timeout_version="$("$release_timeout_path" --version)"
if [[ "$release_timeout_version" != *"GNU coreutils"* ]]; then
  echo "GNU timeout is required before preparing release compatibility." >&2
  exit 2
fi

printf 'Using GNU timeout: %s\n' "$release_timeout_path"
printf '%s\n' "$release_timeout_version"

# 只为当前任务提供历史源码识别的命令名，后续 step 通过 GITHUB_PATH 继承。
release_timeout_bin="$(mktemp -d "${RUNNER_TEMP%/}/repoctl-release-timeout.XXXXXX")"
ln -s "$release_timeout_path" "$release_timeout_bin/timeout"
printf '%s\n' "$release_timeout_bin" >> "$GITHUB_PATH"
