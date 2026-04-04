# Issue Fix Checklist

## 标准顺序

1. 创建 worktree。
2. 建立最小复现。
3. 稳定复现后定位根因。
4. 只修改根因相关源码包。
5. 补 unit tests。
6. 补 e2e tests。
7. 必要时补 changeset。
8. 跑定向验证。
9. 开 PR。
10. 合并后清理 worktree。

## 高频遗漏

- 忘记先开 `git worktree`
- 复现还不稳定就直接修源码
- 只补 `e2e-apps/github-issues`，没补根因单测
- 漏掉 `project.private.config.json` 的 `condition.miniprogram.list`
- 漏掉 changeset 或 PR 文案同步
