# GitHub Issue Fix Checklist

## 标准顺序

1. 创建 worktree。
2. 在 `e2e-apps/github-issues` 建立最小复现。
3. 稳定复现后分析根因。
4. 只修改根因相关源码包。
5. 补 unit tests。
6. 补 e2e tests。
7. 补 changeset。
8. 跑定向验证。
9. 开 PR。
10. 合并后清理 worktree。

## 常见遗漏

- 忘记先开 `git worktree`。
- 先改源码，后补复现。
- 只改 `e2e-apps/github-issues`，没有补根因单测。
- 漏掉 `project.private.config.json` 的 `condition.miniprogram.list`。
- 漏掉 changeset。
- 涉及 `weapp-vite` / `wevu` / `templates/*` 时漏掉 `create-weapp-vite` bump。

## 最小验证

- 相关 unit tests。
- 相关 `e2e-apps/github-issues` build/test。
- 必要时补 IDE 或 runtime 定向验证。
