# 标准 Vite 插件：生产构建 alpha 实施记录

关联总追踪项：[#1097](https://github.com/weapp-vite/weapp-vite/issues/1097)。此记录只描述已经实现的生产构建切片，不代表整个集成规划完成。

## 已实现

- 发布入口 `weapp-vite/vite` 和无参数 `weapp()`，保留顶层 `weapp`。
- 宿主直接执行主产物构建，不使用虚假 HTML 入口或调用 `wv build` 包装原生命令。
- 配置来源选择与归一化分离；宿主路径只消费本次加载的配置，旧 `wv` 保留双配置行为。
- 插件工厂返回固定槽位，配置阶段绑定内部实现，保留钩子过滤器、顺序及调用上下文。
- 每次构建独立上下文、显式路由宏上下文、按上下文隔离宏缓存；关闭等待进行中的扫描和依赖准备。
- 主包和普通分包、原生 TS、Wevu Vue、自动路由和常规 npm 产物。
- npm 依赖只在会话临时目录准备，最终文件作为宿主 bundle 资源 emit/write；关闭和失败都会回收临时目录。
- 普通 Vite / Vite+ core 配套 Rolldown 定位与能力校验，失败不静默回退。
- Vitest、preview 和 serve 配置检查不启动小程序编译；测试识别不依赖 `mode=test`。
- 已完成的插件实例再次用于构建或测试时清除旧编译绑定；重复安装和活动实例共享明确报错。

首版还拒绝 `build --watch`、原生 dev、React、独立分包、worker、微信插件双产物、lib、多平台及 Web 混合配置。npm 自定义 `buildOptions` 回调与 `packNpmManually` 暂时拒绝，以免外部输出映射绕过宿主所有权。

## 可复现验证

包级命令：

```sh
pnpm --filter weapp-vite typecheck
pnpm --filter weapp-vite build
pnpm --filter weapp-vite test:types
pnpm vitest run packages/weapp-vite/test/vite-plugin.test.ts packages/weapp-vite/src/vite/session.test.ts packages/weapp-vite/src/runtime/viteHost/engine.test.ts packages/weapp-vite/src/utils/file/vueConfig.sessions.test.ts
```

发布包消费脚本：

```sh
node packages/weapp-vite/scripts/verify-vite-host-consumer.mjs <独立临时消费目录>
```

脚本会重建测试源文件并清理该临时目录的 `dist` 和 `.weapp-vite`，不能用于业务项目。目录必须位于维护仓库之外，`package.json` 设置 `private: true` 且名称以 `weapp-vite-host-` 开头。先安装本地 `pnpm pack` 生成的 tarball，不使用 workspace 链接。

消费项目验证组合：

| 宿主 | 依赖 | 安装约束 |
| --- | --- | --- |
| Vite | `vite@8.3.1`、`vitest@5.0.2`、weapp-vite tarball | npm 正常 peer 校验 |
| Vite+ | `vite-plus@1.0.0`、`vite` alias 到 `@voidzero-dev/vite-plus-core@1.0.0`、`vitest@5.0.1`、weapp-vite tarball | npm overrides 将全部 `vite` 指向同一 alias；探针使用 `--legacy-peer-deps` |

本次两个独立消费项目都用 `@swc/core@1.16.2` override 和 `npm install --ignore-scripts`。原因是可选 SWC 新版二进制下载超时；支持的 TS/Vue 路径不依赖 SWC。这是验证环境约束，不是新的产品依赖要求。Vite+ alias 的包版本为 1.0.0，与部分生态包要求的 Vite 8 peer 版本范围不同，因此不能把本次结果描述为 npm 严格 peer 安装已经通过。

脚本检查发布 exports、宿主与编译器实际解析到同一个 Vite 文件、真实 `vp test`/Vitest 无输出副作用、异步配置类型、单次配置求值、TS/Vue/分包产物、`wv prepare/build`。同时探测 `dev`/`scan` 及 bundled-development 的 `getRolldownOptions`、`storeOutputFiles`、`listen`；该探针不代表 stateful HMR 已集成或通过运行时测试。

运行时用例使用已有真实 AppID 和页面条件，无需新增页面：

```sh
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/vite-plugin.runtime.test.ts e2e/ide/vite-plugin-npm.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/vite-plugin.runtime.test.ts e2e/ide/vite-plugin-npm.runtime.test.ts
```

上述两条 E2E 必须串行；macOS 长时间执行使用 `caffeinate -dimsu --` 包裹。首次启动前检查残留 E2E/开发进程。Vue 用例覆盖首页和普通分包，npm 用例覆盖 TDesign 的 bare/index 导入、真实组件 DOM、打开和关闭 Dialog。

## 后续门槛

- P0：原生生产生命周期和配套引擎已通过消费验证；开发接口只完成能力探针。
- P1/P2/P3：生产构建路径已落地；旧 CLI 仍保留旧执行器，尚未完成全路径统一。
- P4/P5：classic 和 stateful 宿主开发会话尚未实现，不能移除 dev/watch 拒绝分支。
- P6：完成真实测试宿主无副作用检查；mpcore artifact、matcher 同实例和 test watch 尚未集成验证。
- P7：文档和发布入口已同步；脚手架 `--toolchain` 尚未实现。
- P8：本地 macOS 和运行时定向验证；Windows/Linux、性能基线和完整发布矩阵仍待执行。
- 缓存协作、Dashboard/MCP 会话订阅、其他高级目标和 Web 多环境仍未实现。

新增宿主模块按配置协调、插件槽位、会话和 npm 准备拆分。原有超过 300 行的配置加载文件把来源选择移入独立模块；既有大型 npm builder 只调整依赖解析锚点，没有顺带重排其构建职责。

## 本轮验证结果

- 包级 typecheck、公开类型契约及 107 个定向单元/集成用例通过。
- 最终 tarball 在上述两个独立消费项目复验通过。
- 两个新增 runtime suite 共 3 个用例，headless 与真实微信开发者工具均通过。真实 IDE 曾出现一次 simulator 启动异常，经既有恢复流程重新启动后通过，未弱化 DOM 断言。
- 两个 suite 已加入正式 headless 与 IDE 清单；清单回归 29 个用例、共享 IDE 启动约束与 DOM 验收清单检查通过。
- scoped ESLint 与 website 构建通过；跨平台 CI 和性能验证尚未执行。
