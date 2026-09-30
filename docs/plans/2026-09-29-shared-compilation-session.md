# 三入口共享编译会话：资源所有权基础

关联 #1097，依赖生产构建 alpha #1099。本阶段让独立 CLI 的生产构建与标准插件共用配置初始化和资源生命周期，后续 classic dev、build watch、stateful 与高级目标继续分阶段交付。

## 行为与边界

- `CompilerSession` 显式持有独立上下文，统一初始化、任务跟踪和幂等关闭。CLI 主构建不再切换进程级活动上下文；旧 `createCompilerContext` 保留历史调用契约。
- 插件继续消费宿主已加载的配置；配置检查不生成支持文件。CLI 保留已有配置发现与支持文件策略。
- 关闭等待已经接受的配置/编译任务，反序执行所有资源清理；单个清理失败不阻止其他清理。配置加载失败也等待已启动的支持文件任务。
- 主构建失败时等待已经启动的 npm、worker、项目配置同步任务结束后再向外传播原始错误，避免关闭后仍有子构建继续写入。
- `wv build` 移除扫描全进程 Sass 子进程的兜底清理，仅通过所属 backend / watcher 生命周期释放资源。关闭失败不会掩盖最初的构建错误。
- 最终编译产物继续由 Vite/Rolldown 原生 emit/write 输出。

这不是统一执行核心的全部实现：CLI 的进程环境与完成后退出逻辑仍留在命令适配层；插件双产物的历史子构建、开发驱动和高级目标尚未迁入新会话。标准插件仍保留 alpha 的能力拒绝，不据此宣称 dev/watch 或完整能力对齐。

## 回归与复现

```sh
pnpm --filter weapp-vite typecheck
pnpm --filter weapp-vite test:types
pnpm vitest run packages/weapp-vite/src/runtime/compilerSession/session.test.ts packages/weapp-vite/src/createContext.test.ts packages/weapp-vite/src/cli/commands/build.test.ts packages/weapp-vite/src/cli/commands/buildUpload.test.ts packages/weapp-vite/src/runtime/buildPlugin/service.test.ts packages/weapp-vite/src/backends/miniprogram.test.ts packages/weapp-vite/src/vite/session.test.ts packages/weapp-vite/test/vite-plugin.test.ts
pnpm --filter weapp-vite build
node packages/weapp-vite/scripts/verify-vite-host-install.mjs wv
node packages/weapp-vite/scripts/verify-vite-host-install.mjs vite
node packages/weapp-vite/scripts/verify-vite-host-install.mjs vite-plus
```

163 个定向测试覆盖同进程项目隔离、关闭等待、启动失败、清理失败、npm/worker 子任务失败传播，以及现有 CLI/upload 和插件构建契约。包级类型检查与公开类型契约通过。

运行时沿用两个 provider-compatible suite：`e2e/ide/vite-plugin.runtime.test.ts` 分别通过 `wv build` 与原生 `vite build` 重建同一 Vue/普通分包 fixture，每种入口独立 suite，构建后只启动一次 automator，并使用 `reLaunch` 切页；npm suite 保留真实组件 DOM 和 Dialog 交互。沿用 fixture 的真实 AppID 和页面条件，没有新增页面。

```sh
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/vite-plugin.runtime.test.ts e2e/ide/vite-plugin-npm.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/vite-plugin.runtime.test.ts e2e/ide/vite-plugin-npm.runtime.test.ts
```

两个命令必须串行，先重建包，先 headless 后真实 IDE；macOS 实际执行使用 `caffeinate -dimsu --`。最新 headless 与真实微信开发者工具各 4 个用例全部通过，两个 provider 观察结果一致。另使用 `style-import-vue` fixture，并设置 `WEAPP_VITE_DISABLE_COMPLETED_BUILD_EXIT=1` 验证 Sass 生产构建能自然退出。

新增会话代码按 context / lifecycle / task completion 拆分，单文件低于 300 行。既有大型 `buildPlugin/service.ts` 仅替换失败传播与等待边界，保留当前编译调度布局，避免把开发驱动迁移与本次生命周期修正混在一起。后续按宿主适配与构建计划边界继续拆分。
