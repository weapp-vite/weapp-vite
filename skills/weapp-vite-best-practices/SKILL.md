---
name: weapp-vite-best-practices
description: 面向采用 weapp-vite 项目布局仓库或已安装 `weapp-vite` 依赖项目的工程化实践手册，覆盖 `vite.config.ts` 的 `weapp` 配置、内置 i18n、自动路由、routeRules/layout、buildScope、自动导入组件、分包、npm、六平台单目标构建、受管 TypeScript、HMR、sourcemap、`prepare`、MCP、Web runtime、lib mode、worker、AI skills，以及与 `weapp-ide-cli` 的命令治理边界。
---

# weapp-vite-best-practices

## 用途

用稳定默认值先把 weapp-vite 项目跑顺，再按目标逐步接入分包、AI、Web runtime、库模式和性能优化。

## 何时使用

- 用户要配置 `vite.config.ts` 里的 `weapp`。
- 用户要排查输出缺页、路径不对、自动路由不生效、layout 不生效。
- 用户要接入分包、npm 落位、多平台、worker、web runtime、lib mode。
- 用户要处理支付宝 `.axml/.acss`、抖音 `.ttml/.ttss`、`buildScope`、sourcemap 或自动 HMR 模式选择。
- 用户要用 Vitest 对真实小程序编译产物进行页面或组件测试。
- 用户要让 AI 正确使用项目，包括 `AGENTS.md`、`dist/docs`、screenshot / compare / logs / mcp。
- 用户要梳理 `weapp-vite` 与 `weapp-ide-cli` 的命令归属、透传边界、`preview/upload/open/config` 这类 DevTools CLI 能力。

## 不适用场景

本 skill 聚焦项目级架构、CLI 所有权、构建编排和 AI 工作流对齐。

- `.vue` 宏和模板兼容：使用 `weapp-vite-vue-sfc-best-practices`。
- `wevu` 生命周期、状态和事件：使用 `wevu-best-practices`。
- 原生迁移：使用 `native-to-weapp-vite-wevu-migration`。
- React 19 JSX/TSX、render mode 和组件 bridge：使用 `weapp-vite-react-best-practices`。

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
   - 多平台始终单目标构建；显式选择微信、支付宝、抖音、百度、京东、小红书或 Web，不把一次构建描述成同时产出全部平台
   - `weapp.autoRoutes`
   - `weapp.autoImportComponents`
   - `weapp.i18n`：基于 `@weapp-vite/i18n` 的微信平台 locale JSON 编译与运行时切换；`defaultLocale` 必填，默认扫描 `**/i18n/*.json`
   - `weapp.uniApp`：实验性外部 uni-app Vue SFC 转换；npm 包必须显式加入 `include` 白名单
   - `weapp.routeRules`
   - `weapp.styles`：生成主包独立样式入口并按规则注入主包与普通分包；不修改 `app.wxss`，也不跨入独立分包
   - `weapp.buildScope` / `wv dev|build --scope`：限定页面或分包构建时保持 autoRoutes 的主包/分包归属
   - `weapp.typescript`
   - `weapp.hmr.runtime`：显式配置优先；未配置时结合工作区 `compileHotReLoad` 选择 classic 或实验性 stateful 模式；实际 bundle 含 Skyline renderer 时强制关闭 DevTools 热重载并降级 classic
   - `weapp.vue.template.slotFallbackWrapperStrategy`：微信平台默认使用内部 `virtualHost` 组件承载转发 `<slot />` 的具名插槽 fallback；需要旧版真实节点行为时显式设为 `view`
   - `weapp.vue.template.slotFallbackWrapper`：普通具名插槽 fallback 的真实 wrapper，可用全局默认、按模板标签名 `component`、子组件静态 `defineOptions({ name })` 的 `componentName`、slot 规则和组件内 `slot-wrapper` / `slot-wrapper-footer` / `slot-wrapper-class` / `slot-wrapper-footer-class` 静态覆盖；显式配置后优先于默认策略；不要把 `block` 当作转发 `<slot />` 的 wrapper
3. 按目标启用能力：
   - AI / 调试：`weapp.forwardConsole`、`weapp.mcp`、`wv mcp init|print|doctor`、`wv screenshot`、`wv compare`、`wv ide logs --open`
   - 产物与结构：`subPackages`、`npm`、`chunks`、`worker`、`weapp.analyze.budgets` / `history`
   - 进阶链路：`web`、`lib`
   - 页面/组件单测：`@mpcore/weapp-vite` 构建产物，`@mpcore/test` 提供 render/query/user，`@mpcore/vitest` 提供每测试隔离和 matcher
   - i18n：Native Component 与 Component Page 使用 `behaviors: [I18n]`；传统 `Page({...})` 才使用兼容适配器 `I18nPage`；主包与普通分包共享实例，独立分包从默认语言创建实例；无 Vite 原生项目直接使用 `@weapp-vite/i18n`
   - React 项目：这里只判断项目级 `weapp.react` 和构建所有权，TSX/runtime/bridge 细节转交 `weapp-vite-react-best-practices`
4. CLI 与 IDE 所有权保持清晰：
   - `weapp-vite` 原生命令优先
   - `weapp-ide-cli` 只在 catalog 命中后透传
   - 原生命令包含 `dev` / `serve` / `build` / `close` / `analyze` / `init` / `open` / `npm` / `generate` / `prepare` / `mcp`
   - `analyze` 支持 `--json`、`--markdown`、`--report pr`、`--budget-check`、`--hmr-profile`、`--preload`；分包预算来自 `weapp.analyze.budgets`，增量归因来自 `weapp.analyze.history`，预下载审计按触发包汇总实际分包体积与共享的 2 MB 额度
   - `preview` / `upload` / `config` / `screenshot` / `compare` 的帮助、退出码、JSON 输出要稳定
   - 不要让未知命令盲目 passthrough
5. 常见症状先分诊：
   - 输出路径不对：查 `srcRoot`、project config、`build.outDir`
   - 支付宝/抖音原生文件缺失：先核对目标平台描述符、模板/样式扩展名和单目标 `-p <platform>`，不要回退成微信扩展名复制
   - `.weapp-vite` 类型异常：先跑 `wv prepare`
   - 页面 / layout 不对：查 `autoRoutes`、`routeRules`、`definePageMeta`
   - 自动导入异常：查 `autoImportComponents` 与 resolver
   - i18n 构建失败或模板未翻译：查 locale 文件名、重复/非字符串叶子、default/fallback 是否存在、WXS module 是否重名，以及模板是否通过 `I18n` 或传统 Page 的 `I18nPage` 接入；原生无 Vite 项目再检查 `weapp-i18n compile` 产物和 WXS 显式引用
   - Wot UI / uview-plus / uni-app 组件库异常：同时检查 `weapp.uniApp.include`、resolver 的真实 `resolvedId` / `sourceType: 'wevu-sfc'`，以及目标端条件分支
   - AI 无法稳定操作：查 `AGENTS.md`、`dist/docs`、CLI 路由、MCP
   - 分包体积或 HMR 变慢：先跑 `wv analyze --markdown` / `wv analyze --budget-check`，HMR profile 已开启时再跑 `wv analyze --hmr-profile`
   - `preloadRule` 或跨分包跳转：先跑 `wv analyze --preload`，只把宿主导航 API 和可证明路由 binding 作为证据；结合按触发包聚合的实际体积与 2 MB 额度后，再显式配置 `weapp.routeRules.<pattern>.preload`
   - 状态保持 HMR 不生效：先确认生成的应用/页面 JSON 未使用 Skyline；WebView 项目再确认平台为微信、DevTools 开启服务端口与热重载、`compileHotReLoad: true`，并区分安全 JS/Vue 补丁与 CSS/资源/配置的完整重载回退
   - sourcemap 漂移：检查 CLI `--sourcemap` 透传和构建后 npm、平台 API、shared chunk 重写是否组合原 map，不接受只保留旧 map
6. 评估 Rust/native 加速时，先看真实 profile 和跨边界调用次数：
   - 默认把 JS ↔ Rust 往返、序列化/反序列化和 AST 数据搬运视为热路径成本。
   - 优先 batch analysis，一次传源码、一次 parse、一次返回多个分析结果。
   - 避免把同一份源码上的多个小 AST 查询拆成多个 N-API 调用；如果必须细粒度调用，先证明真实 HMR/build 热路径有净收益。
   - native fast path 必须显式启用、可选依赖、失败回退 Babel/Oxc/Vue compiler，并配 correctness 对齐测试与 profile。
7. 验证按最小范围进行；若改了 `packages/*/src/**`，下游验证前先重建对应包，并明确 `dist sync: rebuilt weapp-vite before downstream validation`。

## 近期能力决策

- 插件项目先确认 `weapp.pluginRoot`，结构变化必须同时检查主应用 `dist/` 和插件 `dist-plugin/`；不要只验证 host 产物。
- 状态保持 HMR 仅适用于微信小程序 WebView：需要 DevTools 服务端口、热重载和 `setting.compileHotReLoad: true`。实际 bundle 检测到 Skyline renderer 时，即使显式选择 stateful 也会输出官方兼容性警告、关闭项目私有配置中的热重载并降级 classic；切回 WebView 后不自动重新开启。JS/Vue 安全补丁可保留实例状态；CSS、资源、JSON、配置、边界不兼容或补丁失败时应接受完整构建回退。
- Web runtime 只验证 Web 语义，不把它当成小程序真机等价环境；请求 globals、URL 和平台 API 兼容问题要分别在目标 runtime 验证。
- 小程序单测不使用 jsdom；`@mpcore/test` 只暴露逻辑 WXML 树。测试产物必须通过 `weapp-vite/test` 交给 Vite/Rolldown emit，不能由适配器手写 bundle。
- uni-app 兼容层默认关闭，只转换项目源码与 `include` 白名单依赖；Wot UI 与 uview-plus 分别以 `@wot-ui/ui@2.2.0`、`uview-plus@3.8.86` 的 npm 发布包 SFC 清单为兼容基线，不把它们泛化成完整 uni-app runtime。
- 分包、插件、worker 和 lib mode 的性能判断都先看产物结构与 `wv analyze`，再改 chunk/shared 策略。
- 主包共享样式优先使用 `weapp.styles` 保持独立产物；`inject: false` 只 emit，独立分包必须通过自己的 `subPackages.<root>.styles` 持有副本。
- 内置 i18n v1 只支持 `{name}` / `{user.name}` 插值，不提供 ICU、复数、日期/数字格式化或自动 storage 持久化；非微信平台不要启用。

## 参考决策表

- HMR 行为：`references/stateful-hmr-playbook.md`
- 插件双产物：`references/plugin-build-playbook.md`
- Web runtime 与 URL：`references/web-runtime-compatibility.md`
- native AST：`references/native-ast-performance-checklist.md`

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
- `references/stateful-hmr-playbook.md`
- `references/plugin-build-playbook.md`
- `references/web-runtime-compatibility.md`
- `references/native-ast-performance-checklist.md`
