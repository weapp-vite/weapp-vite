#!/usr/bin/env bash

resolve_release_timeout() {
  local release_timeout_candidate release_timeout_path release_timeout_version
  for release_timeout_candidate in timeout gtimeout gnutimeout; do
    release_timeout_path="$(type -P -- "$release_timeout_candidate")" || continue
    if release_timeout_version="$("$release_timeout_path" --version 2>/dev/null)" \
      && [[ "$release_timeout_version" == *"GNU coreutils"* ]]; then
      printf '%s\n' "$release_timeout_path"
      return 0
    fi
  done
  echo "GNU timeout is required (tried timeout, gtimeout, gnutimeout)." >&2
  return 2
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  resolve_release_timeout
fi
