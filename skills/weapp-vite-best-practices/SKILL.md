---
name: weapp-vite-best-practices
description: 面向采用 weapp-vite 项目布局仓库或已安装 `weapp-vite` 依赖项目的工程化实践手册，覆盖 `vite.config.ts` 的 `weapp` 配置、自动路由、routeRules/layout、自动导入组件、分包、npm、多平台、受管 TypeScript、`prepare`、`forwardConsole`、`mcp`、`screenshot/compare/ide logs`、Web runtime、lib mode、worker、`dist/docs`、脚手架 `AGENTS.md` 与 AI skills 安装等当前能力。
---

# weapp-vite-best-practices

## 目的

用稳定默认值先把 weapp-vite 项目跑顺，再按目标逐步接入分包、AI、Web runtime、库模式和性能优化。

## 触发信号

- 用户要配置 `vite.config.ts` 里的 `weapp`。
- 用户要排查输出缺页、路径不对、自动路由不生效、layout 不生效。
- 用户要接入分包、npm 落位、多平台、worker、web runtime、lib mode。
- 用户要让 AI 正确使用项目，包括 `AGENTS.md`、`dist/docs`、screenshot / compare / logs / mcp。

## 适用边界

本 skill 聚焦项目级架构、构建编排和 AI 工作流对齐。

以下情况不应作为主 skill：

- 主要是 `.vue` 宏和模板兼容。使用 `weapp-vite-vue-sfc-best-practices`。
- 主要是 `wevu` 生命周期、状态和事件。使用 `wevu-best-practices`。
- 主要是原生迁移。使用 `native-to-weapp-vite-wevu-migration`。

## 快速开始

1. 先确认 `srcRoot`、输出目录和页面来源。
2. 再确认是手写 `app.json` 还是 `autoRoutes`。
3. 若类型或产物异常，先跑 `wv prepare`。
4. 若项目已安装 `weapp-vite`，优先读本地 `node_modules/weapp-vite/dist/docs/`。
5. 若项目来自脚手架，先读根 `AGENTS.md`。

## 执行流程

1. 先收集上下文

- 看 `vite.config.ts`
- 看 `app.json` / `app.json.ts`
- 看分包、组件、页面目录
- 看 package scripts
- 看根 `AGENTS.md`
- 看本地 `dist/docs`

2. 保持配置分层清晰

- 顶层 Vite 字段：`build`、`resolve`、`server`、`css`
- 小程序专属字段：`weapp.*`

优先把这些基础项先理顺：

- `weapp.srcRoot`
- `weapp.platform`
- `weapp.multiPlatform`
- `weapp.autoRoutes`
- `weapp.autoImportComponents`
- `weapp.routeRules`
- `weapp.typescript`

3. 按目标启用能力

- AI / 调试：
  - `weapp.forwardConsole`
  - `weapp.mcp`
  - `wv screenshot`
  - `wv compare`
  - `wv ide logs --open`
- 产物与结构：
  - `subPackages`
  - `npm`
  - `chunks`
  - `worker`
- 进阶链路：
  - `web`
  - `lib`

4. 症状分诊

- 输出路径不对：先查 `srcRoot`、project config、`build.outDir`
- `.weapp-vite` 类型或提示不对：先跑 `prepare`
- 页面 / layout 不对：查 `autoRoutes`、`routeRules`、`definePageMeta`
- 组件没自动注册：查 `autoImportComponents`、`wxml` 扫描和 resolver
- AI 无法稳定操作项目：查 `AGENTS.md`、`dist/docs`、CLI 路由和 MCP

5. 保持 CLI 所有权清晰

- `weapp-vite` 原生命令优先
- `weapp-ide-cli` 通过 catalog 命中后再透传
- `wv` 视为 `weapp-vite` 等价别名

6. 验证顺序

- 先最小改动、最小验证
- 若改了 `packages/*/src/**` 再做下游验证，先重建对应包
- 下游验证前要明确：`dist sync: rebuilt weapp-vite before downstream validation`

## 约束

- 不要在 `srcRoot` 和页面来源没确认前先调 chunk 策略。
- 不要把 Web runtime 当作小程序真机等价运行时。
- 不要忽略 `AGENTS.md` 和 `dist/docs`，它们是当前 AI 合约的一部分。
- 不要让 `weapp-vite` 和 `weapp-ide-cli` 命令名单分裂。

## 输出要求

应用本 skill 时，输出必须包含：

- 诊断摘要。
- 最小改动列表。
- 推荐验证命令。
- 分包 / chunk / AI 工作流的取舍说明。

## 完成检查

- `weapp` 配置结构清晰。
- 路由和组件来源明确。
- `.weapp-vite` 支持文件流程已考虑。
- CLI 原生命令、IDE 透传和 AI 路由不冲突。
- `AGENTS.md`、`dist/docs`、MCP、截图和日志入口保持一致。

## 参考资料

- `references/config-playbook.md`
- `references/debug-playbook.md`
- `references/cli-dispatch-playbook.md`
