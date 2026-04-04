---
name: weapp-vite-best-practices
description: 面向采用 weapp-vite 项目布局仓库或已安装 `weapp-vite` 依赖项目的工程化实践手册，覆盖 `vite.config.ts` 的 `weapp` 配置、自动路由、routeRules/layout、自动导入组件、分包、npm、多平台、受管 TypeScript、`prepare`、`forwardConsole`、`mcp`、`screenshot/compare/ide logs`、Web runtime、lib mode、worker、`dist/docs`、脚手架 `AGENTS.md`、AI skills 安装，以及与 `weapp-ide-cli` 的命令治理和透传边界。
---

# weapp-vite-best-practices

## 用途

用稳定默认值先把 weapp-vite 项目跑顺，再按目标逐步接入分包、AI、Web runtime、库模式和性能优化。

## 何时使用

- 用户要配置 `vite.config.ts` 里的 `weapp`。
- 用户要排查输出缺页、路径不对、自动路由不生效、layout 不生效。
- 用户要接入分包、npm 落位、多平台、worker、web runtime、lib mode。
- 用户要让 AI 正确使用项目，包括 `AGENTS.md`、`dist/docs`、screenshot / compare / logs / mcp。
- 用户要梳理 `weapp-vite` 与 `weapp-ide-cli` 的命令归属、透传边界、`preview/upload/open/config` 这类 DevTools CLI 能力。

## 不适用场景

本 skill 聚焦项目级架构、CLI 所有权、构建编排和 AI 工作流对齐。

- `.vue` 宏和模板兼容：使用 `weapp-vite-vue-sfc-best-practices`。
- `wevu` 生命周期、状态和事件：使用 `wevu-best-practices`。
- 原生迁移：使用 `native-to-weapp-vite-wevu-migration`。

## 核心流程

1. 先收集上下文：
   - `vite.config.ts`
   - `app.json` / `app.json.ts`
   - 分包、组件、页面目录
   - package scripts
   - 根 `AGENTS.md`
   - 本地 `node_modules/weapp-vite/dist/docs/`
2. 区分顶层 Vite 字段和小程序专属 `weapp.*`，先理顺基础项：
   - `weapp.srcRoot`
   - `weapp.platform`
   - `weapp.multiPlatform`
   - `weapp.autoRoutes`
   - `weapp.autoImportComponents`
   - `weapp.routeRules`
   - `weapp.typescript`
3. 按目标启用能力：
   - AI / 调试：`weapp.forwardConsole`、`weapp.mcp`、`wv screenshot`、`wv compare`、`wv ide logs --open`
   - 产物与结构：`subPackages`、`npm`、`chunks`、`worker`
   - 进阶链路：`web`、`lib`
4. CLI 与 IDE 所有权保持清晰：
   - `weapp-vite` 原生命令优先
   - `weapp-ide-cli` 只在 catalog 命中后透传
   - `preview` / `upload` / `open` / `config` / `screenshot` / `compare` 的帮助、退出码、JSON 输出要稳定
   - 不要让未知命令盲目 passthrough
5. 常见症状先分诊：
   - 输出路径不对：查 `srcRoot`、project config、`build.outDir`
   - `.weapp-vite` 类型异常：先跑 `wv prepare`
   - 页面 / layout 不对：查 `autoRoutes`、`routeRules`、`definePageMeta`
   - 自动导入异常：查 `autoImportComponents` 与 resolver
   - AI 无法稳定操作：查 `AGENTS.md`、`dist/docs`、CLI 路由、MCP
6. 验证按最小范围进行；若改了 `packages/*/src/**`，下游验证前先重建对应包，并明确 `dist sync: rebuilt weapp-vite before downstream validation`。

## 约束

- 不要在 `srcRoot` 和页面来源没确认前先调 chunk 策略。
- 不要把 Web runtime 当作小程序真机等价运行时。
- 不要忽略 `AGENTS.md` 和 `dist/docs`，它们是当前 AI 合约的一部分。
- 不要让 `weapp-vite` 和 `weapp-ide-cli` 命令名单分裂。
- 不要让 `screenshot` / `compare` / `ide logs` 的文件和 JSON 合约漂移。

## 输出

应用本 skill 时，输出必须包含：

- 诊断摘要。
- 最小改动列表。
- 推荐验证命令。
- 分包 / chunk / AI 工作流的取舍说明。

## 完成标记

- `weapp` 配置结构清晰。
- 路由和组件来源明确。
- `.weapp-vite` 支持文件流程已考虑。
- CLI 原生命令、IDE 透传和 AI 路由不冲突。
- `AGENTS.md`、`dist/docs`、MCP、截图和日志入口保持一致。

## 参考资料

- `references/config-playbook.md`
- `references/debug-playbook.md`
- `references/cli-dispatch-playbook.md`
- `references/ide-command-playbook.md`
- `references/ide-i18n-config-playbook.md`
