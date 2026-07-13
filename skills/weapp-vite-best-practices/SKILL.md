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
   - `weapp.hmr.runtime`：默认 `classic`；微信开发者工具需要保留 Page/Component/wevu 状态时可实验性使用 `stateful-experimental`
   - `weapp.vue.template.slotFallbackWrapperStrategy`：微信平台默认使用内部 `virtualHost` 组件承载转发 `<slot />` 的具名插槽 fallback；需要旧版真实节点行为时显式设为 `view`
   - `weapp.vue.template.slotFallbackWrapper`：普通具名插槽 fallback 的真实 wrapper，可用全局默认、按模板标签名 `component`、子组件静态 `defineOptions({ name })` 的 `componentName`、slot 规则和组件内 `slot-wrapper` / `slot-wrapper-footer` / `slot-wrapper-class` / `slot-wrapper-footer-class` 静态覆盖；显式配置后优先于默认策略；不要把 `block` 当作转发 `<slot />` 的 wrapper
3. 按目标启用能力：
   - AI / 调试：`weapp.forwardConsole`、`weapp.mcp`、`wv mcp init|print|doctor`、`wv screenshot`、`wv compare`、`wv ide logs --open`
   - 产物与结构：`subPackages`、`npm`、`chunks`、`worker`、`weapp.analyze.budgets` / `history`
   - 进阶链路：`web`、`lib`
4. CLI 与 IDE 所有权保持清晰：
   - `weapp-vite` 原生命令优先
   - `weapp-ide-cli` 只在 catalog 命中后透传
   - 原生命令包含 `dev` / `serve` / `build` / `close` / `analyze` / `init` / `open` / `npm` / `generate` / `prepare` / `mcp`
   - `analyze` 支持 `--json`、`--markdown`、`--report pr`、`--budget-check`、`--hmr-profile`，分包预算来自 `weapp.analyze.budgets`，增量归因来自 `weapp.analyze.history`
   - `preview` / `upload` / `config` / `screenshot` / `compare` 的帮助、退出码、JSON 输出要稳定
   - 不要让未知命令盲目 passthrough
5. 常见症状先分诊：
   - 输出路径不对：查 `srcRoot`、project config、`build.outDir`
   - `.weapp-vite` 类型异常：先跑 `wv prepare`
   - 页面 / layout 不对：查 `autoRoutes`、`routeRules`、`definePageMeta`
   - 自动导入异常：查 `autoImportComponents` 与 resolver
   - AI 无法稳定操作：查 `AGENTS.md`、`dist/docs`、CLI 路由、MCP
   - 分包体积或 HMR 变慢：先跑 `wv analyze --markdown` / `wv analyze --budget-check`，HMR profile 已开启时再跑 `wv analyze --hmr-profile`
   - 状态保持 HMR 不生效：确认平台为微信、DevTools 开启服务端口与热重载、`compileHotReLoad: true`，并区分安全 JS/Vue 补丁与 CSS/资源/配置的完整重载回退
6. 评估 Rust/native 加速时，先看真实 profile 和跨边界调用次数：
   - 默认把 JS ↔ Rust 往返、序列化/反序列化和 AST 数据搬运视为热路径成本。
   - 优先 batch analysis，一次传源码、一次 parse、一次返回多个分析结果。
   - 避免把同一份源码上的多个小 AST 查询拆成多个 N-API 调用；如果必须细粒度调用，先证明真实 HMR/build 热路径有净收益。
   - native fast path 必须显式启用、可选依赖、失败回退 Babel/Oxc/Vue compiler，并配 correctness 对齐测试与 profile。
7. 验证按最小范围进行；若改了 `packages/*/src/**`，下游验证前先重建对应包，并明确 `dist sync: rebuilt weapp-vite before downstream validation`。

## 约束

- 不要在 `srcRoot` 和页面来源没确认前先调 chunk 策略。
- 不要把 Web runtime 当作小程序真机等价运行时。
- 不要忽略 `AGENTS.md` 和 `dist/docs`，它们是当前 AI 合约的一部分。
- 不要让 `weapp-vite` 和 `weapp-ide-cli` 命令名单分裂。
- 不要让 `screenshot` / `compare` / `ide logs` 的文件和 JSON 合约漂移。
- 不要用大量细粒度 JS ↔ Rust 调用替代原本一次 JS AST 遍历；native 加速要先合并通信边界，再用真实 profile 扩大覆盖。

## 输出

应用本 skill 时，输出必须包含：

- 诊断摘要。
- 最小改动列表。
- 推荐验证命令。
- 分包 / chunk / AI 工作流的取舍说明。
- 若涉及 Rust/native 加速，说明是否减少跨边界调用次数，以及真实 profile 是否支持继续扩大迁移。

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
