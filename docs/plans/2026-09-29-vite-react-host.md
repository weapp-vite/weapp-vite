# React 三入口编译对齐

## 范围

沿用顶层 `weapp.react`，向标准插件的固定插件集合增加既有 React 编译器。普通 Vite、Vite+ 与独立 `wv` 共用静态 WXML、动态模板、原生/Wevu bridge 及可选 SWC 编译，不另造 React 宿主配置。

生产构建、classic、build watch 与 stateful 都处理 TSX 模板更新；静态 TSX 在 stateful 模式下按既有协议重建会话，不承诺 hooks 状态在该完整重载中保持。高级目标仍分项开放。

## 根因与修复

- 原插件工厂缺少 React 固定槽且会话在初始化时拒绝 React。复用原编译器后，原生宿主直接承担编译输出。
- React 原来硬编码裁剪 `src/`，macOS 临时目录的符号链接路径与 Vite 真实模块路径不一致时会生成越界资产名。现在通过配置服务 `relativeOutputPath` 统一自定义源码根、真实路径及输出映射。
- 静态 TSX 的 stateful 重启暴露 `server.close()` 与新服务启动竞争。宿主生命周期包装现在等待进行中的重启，并关闭替换后的会话；关闭开始后不再启动排队的重启。

## 验收与消费

源测试复用 `react-runtime-spike` 的源码，在独立临时项目验证默认/自定义源码目录、classic/stateful 更新、原生生产 watch；两项确定性生命周期测试覆盖重启进行中关闭与关闭取消排队重启。

同一 `e2e/ide/react-runtime-spike.runtime.test.ts` 通过 `WEAPP_VITE_E2E_COMPILER_HOST=wv|vite|vite-plus` 选择原生命令，不变更 hooks、事件、静态 WXML 或六种 bridge 互操作断言。suite 只创建一次 automator，沿用真实 AppID/条件页，通过 `reLaunch` 切换场景。

三入口均使用严格 tarball 消费图，包含最新 `@weapp-vite/react`；运行原生 dev、stateful 的 TSX 更新（普通 Vite/Vite+ 额外验证 build watch）后，再执行 headless 或真实 IDE。命令：`node packages/weapp-vite/scripts/verify-vite-host-install.mjs vite-plus headless react`，真实 IDE 把 `headless` 换成 `devtools`。命令中的工具链还可选择 `wv` / `vite`。CI 采用三入口严格消费 headless 矩阵。

## 文件组织

宿主关闭/重启协调抽为 `vite/lifecycle.ts`，避免继续扩展入口文件。runtime suite 保留既有共享启动和 DOM 断言，只扩展命令选择，当前仍低于 300 行。

## 本地验证结果

- 宿主/生命周期 17 项、React 编译器/bridge 13 项定向测试通过；包级类型、公开类型、构建、ESLint、共享 IDE 启动检查、网站构建与 changeset 联动通过。
- 三入口严格 tarball 消费均通过，原生 dev/stateful 更新及 Vite/Vite+ 生产 watch 已验证。
- 同组 runtime 场景通过三入口 headless 3 项、真实微信 IDE 3 项，覆盖 hooks/事件、静态绑定和六种互操作。Vite 首次 IDE 启动重试后通过，未放宽断言。

本地结果不替代当前 PR 的跨平台 CI；高级目标与完整三入口能力对齐仍由 #1097 跟踪。
