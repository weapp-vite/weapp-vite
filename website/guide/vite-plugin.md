---
description: 使用 weapp-vite 标准 Vite 插件与 Vite+ 构建微信小程序，了解顶层 weapp 配置、core 依赖 alias、生产构建 alpha 支持范围，以及开发模式、测试和命令兼容边界。
keywords:
  - weapp-vite
  - Vite 插件
  - Vite+
  - 微信小程序
  - 生产构建
  - Vue SFC
---

# 标准 Vite 插件与 Vite+

`weapp-vite/vite` 提供实验性的生产构建、classic 与 stateful 开发入口。当前阶段支持单目标微信原生 JS/TS、Wevu Vue SFC、React、自动路由、自动组件、普通分包与独立分包。主产物由宿主 Vite 的编译管线生成。

## 配置

项目使用 ESM（`package.json` 设置 `"type": "module"`），或将配置命名为 `vite.config.mts`：

```ts
import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'

export default defineConfig({
  plugins: [weapp()],
  weapp: {
    platform: 'weapp',
    srcRoot: 'src',
    hmr: { runtime: 'classic' },
  },
})
```

插件没有第二套配置参数。配置文件由宿主加载，插件不会自动发现或合并另一份 `weapp-vite.config.*`。迁移时把配置收敛到一个入口；需要拆文件时，在该入口显式导入。不要重复调用 `weapp()`，也不要把同一插件实例共享给两个活动宿主。

```sh
vite build
vite dev
```

`mode: 'test'` 仍可用于生产构建。测试识别依赖实际 Vitest 宿主标识，不根据 mode 猜测。只读取配置不会扫描小程序入口、生成支持文件或启动 IDE/MCP；`wv prepare` 继续负责类型支持文件。

## Vite+

配置中的 `defineConfig` 改为从 `vite-plus` 导入，然后使用 `vp build` / `vp dev`。Vite+ 消费项目须按官方迁移规则把 `vite` 指向配套 core，并确保 weapp-vite 的依赖也解析到同一宿主。例如 npm 项目：

```json
{
  "type": "module",
  "devDependencies": {
    "vite-plus": "1.0.0",
    "vite": "npm:@voidzero-dev/vite-plus-core@1.0.0"
  },
  "overrides": {
    "vite": "npm:@voidzero-dev/vite-plus-core@1.0.0"
  }
}
```

pnpm 使用项目级 `pnpm-workspace.yaml` 的 `overrides` 完成同样的 alias；不要只修改顶层依赖而留下 weapp-vite 内嵌的另一套 Vite。该组合对应 Vite 8.3.1 / Rolldown 1.2.11；Vite+ 项目验证线为 Node 24.11+，普通 weapp-vite 的 Node 范围不变。

## 当前命令边界

| 命令 | 当前行为 |
| --- | --- |
| `vite build` / `vp build` | 实验性微信生产构建 |
| `wv dev` / `wv build` | 保留原有能力；显式插件不会重复安装编译器 |
| `vite dev` / `vp dev` | 实验性 classic / stateful 开发；由宿主管理启动、重启与关闭 |
| `vite build --watch` / `vp build --watch` | 实验性生产 watch：完整目标产物、入口增删与失败恢复 |
| `vp test` | 插件不启动小程序编译；mpcore 测试继续显式使用 artifact API |
| `wv prepare/open/upload/mcp` | 继续使用小程序专属命令 |
| `vp preview` | Vite 的 Web 预览，不是小程序二维码预览 |
| `vp pack` | 通用库打包，不替代小程序 lib mode |

worker、微信插件双产物、lib mode、多平台与 Web 混合宿主未开放。遇到这些目标应使用现有 `wv` 链路，不通过生成部分产物来跳过限制。

常规 npm 依赖先在会话临时目录准备，再作为宿主 bundle 的资源统一写出。当前不开放 `npm.buildOptions` 回调和微信 `packNpmManually` 手工输出映射，避免子任务写入宿主未管理的目录；这两类配置继续使用 `wv build`。

生产构建、build watch、classic 与实验性 stateful dev 已接入。任务缓存、Dashboard/MCP 会话复用、脚手架工具链选项和完整跨平台发布矩阵仍属于后续阶段。完整编译能力对齐继续由 #1097 追踪；高级目标限制是阶段边界。

## classic 开发

`vite dev` / `vp dev` 由宿主负责服务器和配置重载，小程序会话复用现有增量编译调度，产物经 Vite/Rolldown 原生 write 落盘。首次完整产物就绪后才打印小程序就绪日志。脚本、模板、样式和页面增删会更新产物；语法错误修正后继续编译。宿主 `server.close()`（包括 middleware mode）会等待正在执行的构建再释放自有资源。

classic 模式不支持宿主 `experimental.bundledDev: true`，开启时会在启动前报错。classic 更新遵循完整重载语义，不承诺实例状态保持。`wv dev` 保留原有 HMR 选择和全部目标能力。

同一宿主目前只编译一个小程序目标，暂不支持同时开发 Web。插件不会自动打开 IDE、启动 MCP 或上传。

## 检查与排障

- 缺少入口：核对 `weapp.srcRoot`、`app.json`/`app.vue` 和宿主的 `root`。
- ESM 配置加载失败：使用 `type: module` 或 `.mts`，不依赖旧 CLI 的 runner 回退。
- 引擎加载失败：核对 Vite+ core alias 和实际解析路径；配套引擎缺失时会报错，不静默切换到其他 Rolldown。
- 类型检查：继续使用 `wv prepare`、`vue-tsc`/`tsc`、ESLint 与 stylelint；`vp check` 不能替代全部小程序规则。
- 缓存：开发服务、IDE、上传、MCP 与 runtime E2E 不应配置任务缓存。生产缓存的完整恢复与输入失效矩阵尚未验收。

跟踪：[标准插件与 Vite+ 集成 #1097](https://github.com/weapp-vite/weapp-vite/issues/1097)。

## 生产 watch

`vite build --watch` 与 `vp build --watch` 复用生产配置，每轮通过宿主 emit/write 发布当前目标的完整产物。支持脚本、模板、样式更新，页面增删和语法错误恢复；删除页面时清理对应的已拥有产物及 sourcemap。`emptyOutDir: false` 时保留其他工具写入的文件。关闭 watcher 会等待本轮写出和会话资源释放。

这一路径不提供状态保持 HMR，也不自动重启配置文件。修改 Vite 配置或配置依赖后，按宿主 build watch 的语义重新启动命令；需要配置自动重启时使用 classic `vite dev` / `vp dev`。目标能力限制与插件生产构建一致。

## 实验性 stateful 开发

在同一顶层配置中设置 `weapp.hmr.runtime: 'stateful-experimental'`，继续使用 `vite dev` / `vp dev`。适配器安装在宿主的 client 环境，使用其配套 Rolldown DevEngine；不会另起一个 Vite 服务。无需手工开启 `experimental.bundledDev`，但宿主必须提供所需私有 API，能力检查失败会明确报错。

该模式面向微信 WebView，需开启微信开发者工具热重载。当前宿主遇到 Skyline 或缺失私有 API 时明确报错，需显式改用 classic；独立 CLI 的自动降级行为保留。JS 安全补丁、模板与样式更新复用现有 stateful 协议；页面入口拓扑变化由宿主重新创建会话，配置依赖变化由宿主重新加载配置。关闭会等待本会话拥有的任务和引擎；不会关闭其他宿主实例。

普通 Vite 与 Vite+ 均已验证原生 Page/Component 脚本补丁、样式更新、模板往返及 Wevu 本地/store 状态保持，包含 headless 可观察语义与真实微信 IDE。Vite+ 验收在严格安装的独立发布包依赖图中使用原生 `vp dev`；独立 `wv` 同时通过同组 headless 与真实微信 IDE 回归。当前结果覆盖这些定向场景，完整跨平台发布矩阵仍需持续验证。

middleware mode 支持构建与可等待关闭。运行小程序的 stateful 通信还需要消费方把 Vite middleware 挂载到可访问的 HTTP 服务，并配置对应端口；只创建 middleware 服务不会自动提供监听端点。

## React

注册同一个 `weapp()`，继续使用顶层 `weapp.react` 配置和既有 `@weapp-vite/react` 运行时。生产构建、classic、生产 watch 与实验性 stateful 共用 React 编译器；静态 TSX 在 stateful 下按既有规则重建会话，不承诺 React hooks 状态跨此类重载保持。

`renderMode: 'auto'` 可组合静态 WXML、动态模板与原生/Wevu 组件 bridge；`dynamic` 仍不支持原生组件 bridge。React Compiler 继续是可选 SWC 能力，其安装与降级规则不随宿主改变。模板输出使用共享的源码根与输出路径映射，支持自定义 `srcRoot` 和符号链接项目路径。

## 独立分包

`app.json` 或 `app.vue` 中的 `subPackages[].independent`，以及顶层 `weapp.subPackages` 的配置沿用独立 CLI 语义。三入口共享独立子构建；子构建直接复用本次已加载的配置、CLI 覆盖与用户插件，不再次执行配置文件。

每个子构建只生成内存产物，最终由主构建的 Vite/Rolldown 发布。classic、stateful 和原生生产 watch 由宿主调度子包更新，不为独立分包另外创建 watcher。生产 watch 支持独立脚本与模板依赖、语法错误恢复，以及删除分包后的陈旧产物清理。

stateful 下独立分包源码由宿主 watcher 驱动完整更新批次，不承诺子包 JS 状态保持；子包的 Vue、脚本和伴随资产无需进入主 DevEngine 模块图也能触发更新。
