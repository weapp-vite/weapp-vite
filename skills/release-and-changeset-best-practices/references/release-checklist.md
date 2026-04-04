# Release Checklist

## 先判断

- 是否是用户可见或行为变化。
- 是否是源码 bug fix。
- 是否涉及 `weapp-vite` / `wevu` / `templates/*`。

## changeset 规则

- 用户可见或行为变化：通常需要。
- 源码 bug fix：必须需要。
- summary 段落：中文。

## 联动规则

- 涉及 `weapp-vite` / `wevu` / `templates/*`：
  - 检查是否需要 `create-weapp-vite` bump。

## 常用检查

- `node --import tsx scripts/check-create-weapp-vite-changeset.ts`
- `node --import tsx scripts/check-catalog-changeset.ts`

## 交付方式

- 默认 commit-only。
- GitHub issue 修复：按 PR 流程。
