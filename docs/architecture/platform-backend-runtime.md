# Platform Backend 运行时架构

## 背景

第一阶段改造解决 CLI 平台选择与服务编排的所有权分散问题。第二阶段在不改变该边界的前提下，把小程序源码依赖的所有权交还给 Vite/Rolldown 真实模块图。第三阶段把编译器与具体框架/Web runtime 包路径解耦。

三个阶段都不提供第三方 backend 或 runtime provider 注册 API，也不改变现有配置和 CLI 契约。

## 第一阶段边界

`packages/weapp-vite/src/backends/` 包含四类内部对象：

- `PlatformBackendDescriptor`：声明 backend id、别名、runtime 与 capabilities。
- `PlatformBackendDriver`：生成目标 inline config，委托配置合并与 build/dev 生命周期，并关闭 backend 资源。
- `PlatformBackendRegistry`：负责注册唯一性、别名解析、默认目标、组合目标和稳定执行顺序。
- `ResolvedBackendExecution`：CLI 的有序执行计划，也是命令控制流的单一事实源。

当前内置 backend 的注册顺序固定为：

1. `miniprogram`
2. `web`

因此 `--platform all` 与 `--platform both` 保持先执行小程序、再执行 Web。单目标别名仍兼容 `h5`、六个小程序平台及各平台别名；未知平台仍回退到默认小程序平台并输出原警告。

## Capabilities

第一阶段声明以下 capabilities：

| Capability | miniprogram | web | 当前实现所有者                       |
| ---------- | ----------- | --- | ------------------------------------ |
| `build`    | 是          | 是  | `BuildService` / `WebService`        |
| `dev`      | 是          | 是  | `BuildService` / `WebService`        |
| `ide`      | 是          | 否  | 现有 IDE/open 命令与 `weapp-ide-cli` |
| `analyze`  | 是          | 是  | 分包分析 / Web 静态分析              |
| `npm`      | 是          | 否  | 现有 npm 服务与 IDE npm 命令         |
| `workers`  | 是          | 否  | 现有 `BuildService` workers 流程     |
| `lib`      | 是          | 否  | 现有 `BuildService` lib 流程         |

capability 是声明式路由依据，不意味着第一阶段移动所有业务实现。特别是 `npm`、`workers` 和 `lib` 仍由现有服务实现，只归属于 miniprogram backend。

## 数据流与所有权

```text
CLI platform input
  -> PlatformBackendRegistry.resolve()
  -> ResolvedBackendExecution(entries in stable order)
  -> backend driver inline config
  -> createCompilerContext()
  -> command filters entries by capability
  -> driver delegates BuildService/WebService/config merge
  -> driver closes watcher/dev-server resources
```

`ConfigService.merge()` 与 `ConfigService.mergeWeb()` 保留原签名。它们通过 registry 取得对应内置 backend，再由 driver 调用现有 miniprogram/web merge delegate。`mergeWeb` 仍使用 `@weapp-vite/web` 插件路径，最终产物仍完全由 Vite/Rolldown emit/write，不增加手工 bundle 写盘路径。

`runtimeTarget.ts` 保留 `ResolvedWeappViteTarget`、`runMini` 和 `runWeb` 等公开兼容形状，但这些值只是 `ResolvedBackendExecution` 的投影。CLI 不再使用这些布尔值作为核心控制流。

## 小程序平台能力来源

miniprogram backend 不维护第二份平台表。微信、支付宝、百度、抖音、京东和小红书平台的 id、别名及编译/runtime 静态能力继续统一来自 `@weapp-core/shared` 的 `MiniProgramPlatformDescriptor`。backend registry 只负责把这些平台目标路由到同一个 miniprogram driver。

## 第二阶段：真实 Module Graph

`ModuleGraphService` 挂载在 `CompilerContext`，属于 compiler/build infrastructure。它不进入 backend registry，也不改变 `ResolvedBackendExecution` 的目标解析和执行顺序。miniprogram driver 仍只委托现有 build/dev 生命周期。

源码图的数据流为：

```text
app/page/component/layout physical source
  -> logical entry virtual module
  -> physical script static import
  -> sidecar virtual modules
  -> resolved raw source modules
  -> Vite/Rolldown importers and dynamicImporters
  -> ModuleGraphService entry tracing / invalidation
```

逻辑入口协议覆盖 script、template、style、JSON、WXS、layout 和 `usingComponents`。可解析依赖通过 `resolve()` / `load()` 或静态 import 进入真实图；配置文件、glob/目录拓扑、缺失候选和预处理器 include 才保留为 watch input。topology 变化只有一个显式 full rescan 入口。

source graph 与 output graph 的所有权严格分离。前者只读取 bundler graph，不在 `RuntimeState` 或 core plugin 中复制 import edge；后者可以缓存 emitted chunk membership、chunk imports、文件名和逻辑入口归属。`generateBundle` 只处理 output graph，不再从 bundle 反推 source graph，最终持久化仍由 Vite/Rolldown emit/generate/write 完成。

## 第三阶段：Runtime Provider

Runtime provider 描述编译产物所依赖的 runtime 模块，不负责 DevTools/headless 连接、页面状态或调试通道。它与 platform backend、ModuleGraphService 的所有权关系如下：

```text
PlatformBackendRegistry
  -> backend + compilation selection
  -> RuntimeProviderRegistry
  -> provider descriptor (entries / injection / HMR / contract version)
  -> virtual:weapp-vite/runtime[/reactivity|/template]
  -> Vite resolve/load
  -> concrete runtime package
  -> Rolldown output graph and write lifecycle
```

### 共享契约

- `@weapp-core/constants` 持有 `WEAPP_VITE_RUNTIME_CONTRACT_VERSION` 和稳定虚拟模块 ID。
- `@weapp-core/shared` 持有 `RuntimeProviderDescriptorContract` 及 backend、compilation、entry、variant、injection、capability 与 HMR 类型。
- `packages/weapp-vite/src/runtimeProviders/` 持有内部 registry、三个内置 provider 和 Vite resolver，不从 `weapp-vite` 公共入口导出注册 API。

provider descriptor 必须声明 backend、编译模式、注入模式、development/production 入口、capabilities、HMR mode 和 contract version。registry 对 provider id 及 `backend:compilation` 选择键做唯一性校验；缺少选择时直接报错，不能回退到不匹配的 runtime。

### 内置 Provider

| Provider             | 选择条件             | Runtime 入口                                                        | HMR                                |
| -------------------- | -------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `native-miniprogram` | miniprogram + native | 无，`injection: none`                                               | `none`                             |
| `wevu-miniprogram`   | miniprogram + Vue    | `wevu/internal-runtime`、`internal-reactivity`、`internal-template` | `host-reload`                      |
| `web-runtime`        | web + web            | `@weapp-vite/web/runtime`                                           | provider 提供 module accept footer |

`weapp.vue.enable: false` 选择原生 provider，并不装配 Vue/wevu 编译插件。启用 Vue 时，原生文件与 Vue SFC 可以共存；只有 Vue 编译产物引用稳定虚拟入口，因此原生模块不会额外注入框架 runtime。

### 编译器边界

wevu compiler 只生成以下稳定入口：

- `virtual:weapp-vite/runtime`
- `virtual:weapp-vite/runtime/reactivity`
- `virtual:weapp-vite/runtime/template`

具体 wevu 包路径只存在于 `wevu-miniprogram` provider 和旧源码/产物兼容识别中。Web compiler 通过内部 option 接收稳定 runtime module ID 与 provider HMR footer；独立使用 `@weapp-vite/web` plugin 时仍保留原来的 runtime fs path 兼容行为。

resolver 必须通过 Vite `this.resolve()` 加载 provider 入口。Web provider 在此之前使用 Node package exports 定位自身物理入口，隔离应用 tsconfig path/alias 对包子路径的错误前缀改写；定位结果仍进入 Vite/Rolldown 模块图。入口定位失败、Vite 解析失败或 contract version 不匹配时给出包含 provider、variant、module kind 和 entry 的明确诊断，不允许静默选择其他 provider。

Runtime provider 不复制 Vite/Rolldown source graph，不拥有 shared chunk 路由，也不直接写最终文件。subpackage、independent package 和 shared chunk 仍由既有 output graph 逻辑处理，最终产物只通过 bundler emit/generate/write 生命周期生成。

## 后续 QuickApp

QuickApp 接入应从新的 platform backend 和 runtime provider 开始，复用相同虚拟入口与 contract version 诊断。它不得进入 miniprogram 兼容转换路径；原生快应用和 Vue SFC 分别选择各自编译模式，不支持微信小程序转快应用。

## 非目标

- 不开放第三方 backend 注册 API。
- 不开放第三方 runtime provider 注册 API。
- 不新增公开配置项或改变 `weapp.platform` / `weapp.web` 结构。
- 不开放 ModuleGraphService 为第三方 API。
- 不改变输出目录、host metadata 或最终 bundle 的运行语义。
- 不用 `writeFile` 补写、修补或同步最终构建产物。
