# Release Checklist

## 先判断

- 是否是用户可见或行为变化。
- 是否是源码 bug fix。
- 是否涉及 `weapp-vite` / `wevu` / `@weapp-vite/react` / mpcore / `templates/*` / `skills/*` / AI 合约。
- 是否涉及跨平台 launcher、路径、换行符或文件系统假设。

## changeset 规则

- 用户可见或行为变化：通常需要。
- 源码 bug fix：必须需要。
- summary 段落：中文。
- 公开 skill、脚手架 `AGENTS.md` 和任务路由变化属于用户可见 AI 合约。

## 联动规则

- 涉及 `weapp-vite` / `wevu` / `templates/*`：
  - 检查是否需要 `create-weapp-vite` bump。
- 只更新 React skill 而不改变 `@weapp-vite/react` runtime/API 时，不为 runtime 包制造空 bump。

## 常用检查

- `node --import tsx scripts/check-create-weapp-vite-changeset.ts`
- `node --import tsx scripts/check-catalog-changeset.ts`
- 平台敏感变更运行 owning package 的最小跨平台单测，并核对最早 OS 分歧。
- touched DevTools parity 场景核对 devtools/headless 与 mpcore 对应覆盖。

## 交付方式

- 默认 commit-only。
- GitHub issue 修复：按 PR 流程。
