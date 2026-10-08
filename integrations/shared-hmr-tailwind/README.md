# 双宿主实验接入

本目录固定 Taro 和 Tailwind core 源码版本，并保存可审阅的适配补丁。新包不依赖完整 weapp-vite，也不创建 Vite、Rolldown 或 DevEngine；两套宿主继续使用自身引擎版本。

## 重现

在仓库完成依赖安装后运行：

```sh
node integrations/shared-hmr-tailwind/prepare.mjs
```

脚本在 `.tmp/shared-hosts` 创建全新 clone，核对固定 revision、应用补丁、原生构建并安装带 SHA 的 tarball。已有目录会直接报错，避免覆盖其他工作；不发布 npm、不启动 E2E 或 watcher。它使用当前上游 core 的 PostCSS 配套构建，不能将这些实验 tarball 的验证归给未修复的 npm 版本。

生产构建：

```sh
node integrations/shared-hmr-tailwind/run-taro.mjs --build
```

`WEAPP_VITE_TARO_TARGET=wx|zfb|tt` 选择产物目标；`WEAPP_VITE_TARO_CHECKOUT` 可指定已按相同补丁准备的独立 clone。默认读取 `.tmp/shared-hosts/taro`。三平台这里只验编译契约，微信再执行运行时验收。

每次运行下列命令前，分别检查全机真实 E2E/dev-watch 进程并确认空闲：

```sh
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm exec vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/shared-taro-hmr.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm exec vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/shared-taro-hmr.runtime.test.ts
```

每个 suite 复用一次 automator，通过 `reLaunch` 进入同一路由。项目配置沿用 github-issues 的真实 AppID，并声明对应启动页面。headless 使用真实 loopback WebSocket 与 Taro 的 interpreter 模式，真实微信使用原有 devtools 模式；两者都由 Taro 客户端产生 applied 回报，测试不会代发确认。

## 所有权

- `@weapp-vite/hmr` 保存批次、编译协作契约、资产提交状态和映射；已有队列的宿主只使用事务，不叠加队列。
- `@weapp-vite/tailwindcss` 复用 `weapp-tailwindcss/core`，一份快照生成 CSS 并转换模板和 JS。
- Taro 保留 React Refresh、PatchJournal、原有模式与页面生命周期；每个原始回调在窗口入队前捕获对应 CSS/候选集。
- weapp-vite 保留 Vue/Wevu、路由、layout、模块图、输出归属和运行时桥接。导入样式触发的完整重同步路径仍是完整重同步。
- 两个适配器负责原生 emit/write；新内核不直接写构建目录。

## 实验发布前的剩余门槛

上游 [weapp-tailwindcss #1250](https://github.com/sonofmagic/weapp-tailwindcss/pull/1250) 补丁处理精确快照预检、协议相对 URL 和 JS 换行保留。正式依赖必须切到含这些修复的发布版本；当前普通 catalog 依赖不能冒充已包含补丁。真实微信样式透明的既有宿主限制保留独立记录，拆包不宣称修复它。未完成的双宿主 runtime 验证仍阻断最终交付。


## 本轮结果

新包类型/构建通过。Taro 定向宿主测试 146 项通过，关键 20 项在最终批次接入后复跑通过，覆盖真实 DevEngine、失败恢复、类名增删、导入样式、主题依赖和 CSS Modules。微信、支付宝、抖音生产构建均检查页面文件、转义后的 CSS/JS 与 sourcemap。

Taro headless 与真实微信均为 2 场景、6 个 DOM 检查点通过，包含可见颜色、状态保持、事件更新和恢复。最终补丁保留 Taro 原有 React Refresh、PatchJournal、运行时模式与页面生命周期。早期子进程继承 Vitest 的 test 环境所产生的缓存/样式失败已保留在证据里，不能归为 Taro 产品或宿主缺陷。

weapp-vite 的脚本状态保持通过真实微信验证；其首次样式更新的透明问题在拆分版本与未拆分 main 均复现，继续按既有原生对照单独记录。拆分不宣称修复此限制。

仓库外独立验证使用 `node integrations/shared-hmr-tailwind/verify-isolated.mjs`：在系统临时目录安装真实 tarball，断言完整 weapp-vite 无法解析，再使用已安装 Taro 完成原生构建。示例显式通过宿主的 `pnpm overrides` 对齐 Taro 与 Vite 的 Rolldown，以及 Vite 与样式插件的 PostCSS；PostCSS 采用当前仓库实际安装版本，两种安装都验证模块解析身份一致，不依赖历史 lockfile 恰好选择相同版本。公共包不设置全局引擎 override。

## Windows 原子发布回归

Windows 读取句柄可能使同目录原子 `rename` 暂时报 `EPERM`、`EACCES` 或 `EBUSY`，在 run 36693382801 中首先阻断了 `global.wxss` 发布，随后表现为没有 HMR applied 回报。私有 Taro 补丁只在 Windows 对这三种错误每 50ms 重试，最多 20 次；旧文件始终保留，预算耗尽或其他错误仍原样失败。字节仍由 Rolldown emit/write 输出，原子替换仍位于 `writeBundle`，不直接重写最终 bundle。

prepare 在固定上游构建与 typecheck 后执行原子替换及真实 writer 的 9 项测试，覆盖临时占用恢复、永久失败边界、非 Windows/非占用错误立即失败，以及旧文件保留与临时产物清理。原有 Taro runtime 两项测试与 DOM 断言不变，Windows runtime 结果需以修复后 CI 为准。

2026-09-30 本地复核：固定 Taro 版本及打包后的共享依赖重新构建，typecheck、9 项原子发布测试、生产构建通过；上述 headless 与 devtools 最小命令串行运行，均 2/2 通过。两种 provider 沿用一个 describe 级 automator，以 reLaunch 进入同一路由，保留真实 AppID 与条件页；共享启动检查 142 文件通过。真实开发者工具前后均确认正常登录并返回项目列表，服务连接、页面预热和 runtime 断言成功。该结果不替代 Windows runner 对文件占用恢复的复核。
