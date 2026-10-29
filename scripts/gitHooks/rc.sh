# Git 原始参数先进入环境，避免再次拼接到 Lefthook 的 shell 命令中。
case "$0" in
  */commit-msg|commit-msg)
    unset WEAPP_VITE_GIT_COMMIT_MESSAGE_FILE
    if [ "$#" -ne 1 ]; then
      printf '%s\n' 'commit-msg requires exactly one message file argument' >&2
      exit 1
    fi
    export WEAPP_VITE_GIT_COMMIT_MESSAGE_FILE="$1"
    ;;
esac
