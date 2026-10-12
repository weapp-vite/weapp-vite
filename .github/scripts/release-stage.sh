#!/usr/bin/env bash
set -euo pipefail

# 仅供 Ubuntu Release workflow 使用；GNU timeout 管理本阶段整个子进程组。
release_stage="${1:?Release stage is required}"
case "$release_stage" in
  plan|verify|prepare|upload|confirm|finalize) ;;
  *) echo "Unknown release stage: $release_stage" >&2; exit 2 ;;
esac

release_deadline="${REPOCTL_RELEASE_DEADLINE_EPOCH:?Shared release deadline is required}"
if [[ ! "$release_deadline" =~ ^[0-9]+$ ]]; then
  echo "Shared release deadline must be an epoch timestamp" >&2
  exit 2
fi

release_remaining=$((release_deadline - $(date +%s)))
release_kill_grace=5
if ((release_remaining <= release_kill_grace)); then
  echo "Shared 50-minute release budget exhausted before $release_stage" >&2
  exit 124
fi

# 终止宽限也计入共享预算，不能给每个阶段重新分配 50 分钟。
exec timeout --signal=TERM --kill-after="${release_kill_grace}s" \
  "$((release_remaining - release_kill_grace))s" \
  bash -c '
    set -euo pipefail
    # 主命令可能先响应 TERM 退出；监督进程须保留到整个进程组被 KILL。
    trap '\''trap "" TERM; while :; do sleep 1; done'\'' TERM
    pnpm exec repo release ci --stage "$1" &
    wait "$!"
  ' release-stage "$release_stage"
