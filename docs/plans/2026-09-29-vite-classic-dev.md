# 原生 Vite / Vite+ classic 开发会话

关联 #1097，叠加在共享编译会话 #1100 上。独立 `wv`、普通 Vite 与 Vite+ 是长期维护的三种入口；本阶段补齐标准插件的 classic dev，不把 alpha 或 classic 视为完整能力对齐。

## 实现与生命周期

- 宿主 Vite 提供开发服务器、模块图和配置依赖重载；共享 build service 负责小程序快照调度。借用宿主时不另建 provider Vite server，关闭借用不会关闭宿主。
- 脚本变更从宿主图进入调度，页面拓扑和模板资产仍由明确归属的侧车监听处理。输出目录排除监听；同一编译上下文显式关联图、回调和产物清单。
- 宿主 `restart()` 先等待旧会话关闭，再重新加载配置。Vite 8 会先创建新服务再关闭旧环境，因此环境钩子捕获所属会话，避免旧 `closeBundle` 关闭新会话。
- middleware mode 和普通服务器的 `close()` 等待正在执行的快照与原生写入，幂等释放自己的 watcher。初次语法错误保留可恢复会话，修正后完成首次落盘才报告就绪。
- 完整快照的产物清单在原生 `writeBundle` 后提交，删除已不属于当前清单的旧页面及 sourcemap。最终 bundle 仍由 Vite/Rolldown emit/write 写出。
- 共享开发核心不再设置进程级 `NODE_ENV`。插件不启动 CLI 子进程、MCP 或 IDE；测试宿主保持无编译副作用。

## 支持边界

微信原生 TS/JS、Wevu Vue SFC、普通分包与现有 alpha 支持的配置可以使用 `vite dev` / `vp dev`，显式配置 `weapp.hmr.runtime: 'classic'`。尚未支持的 stateful 或 `experimental.bundledDev` 明确报错。`build --watch`、高级目标、其他平台和 Web 同宿主仍继续后续实现。

## 验证

7 个文件共 122 个定向测试通过，包级 typecheck 与公开类型契约通过。定向测试覆盖模板/样式/脚本更新、页面新增删除、语法错误恢复、初始失败恢复、配置导入文件重载且每轮只执行一次、显式重启、middleware 关闭等待和两个活动宿主隔离。另覆盖 borrowed provider 不创建/关闭宿主、原生输出清单与 sourcemap 清理。

```sh
pnpm --filter weapp-vite typecheck
pnpm --filter weapp-vite test:types
pnpm vitest run packages/weapp-vite/test/vite-dev.test.ts packages/weapp-vite/test/vite-plugin.test.ts packages/weapp-vite/src/vite/session.test.ts packages/weapp-vite/src/moduleGraph/devProvider.test.ts packages/weapp-vite/src/runtime/buildPlugin/service.test.ts packages/weapp-vite/src/plugins/outputFinalizer/hmrPublication.test.ts packages/weapp-vite/src/plugins/outputFinalizer/ownership.test.ts
pnpm --filter weapp-vite build
node packages/weapp-vite/scripts/verify-vite-host-install.mjs wv
node packages/weapp-vite/scripts/verify-vite-host-install.mjs vite
node packages/weapp-vite/scripts/verify-vite-host-install.mjs vite-plus
```

消费验证使用打包后的完整 workspace 运行时依赖闭包和独立严格依赖安装，检查真实 `wv dev` / `vite dev` / `vp dev` 的原生 TS 与 Vue 首产物、更新及单次配置执行。Unix 验证脚本只处理自己启动的进程树：Vite+ 启动器的服务可能处于另一进程组，先让服务正常退出，再等待启动器返回；Windows 使用 taskkill 释放测试进程树，关闭等待语义由 middleware 集成用例单独验证。

复用 `e2e/ide/hmr-auto-classic.runtime.test.ts`，同一 fixture 分别通过 `wv dev` 与原生 `vite dev`，真实 IDE 与 headless 均验证初始 DOM/计数器/输入状态、脚本更新、完整重载重置状态和更新后的交互。保留各 provider 的原始行为断言，使用支持静态 inventory 的字面量 for 循环，额外测试两种入口的计划用例清单。未新增页面，沿用真实 AppID 与页面条件。

```sh
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/hmr-auto-classic.runtime.test.ts e2e/ide/vite-plugin.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/hmr-auto-classic.runtime.test.ts
```

上述 runtime 命令全局串行；先重建产物，先 headless 后真实 IDE，macOS 使用 caffeinate。headless 4 个用例、真实微信 IDE classic 2 个用例通过。Vite+ 另有独立发布包 dev 消费验证；这里不宣称已经通过 Vite+ 专属真实 IDE 矩阵。

新宿主与产物所有权模块均低于 300 行。既有大型 `buildPlugin/service.ts` 只调整借用宿主的调度、失败恢复和配置重载边界，复用已验证的编译调度，后续按生命周期进一步拆分。网站、README、随包 docs 和公开 skill 同步，changeset 包含 weapp-vite 与 create-weapp-vite。
