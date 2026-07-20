# Platform Backend 运行时架构

## 背景

第一阶段改造解决 CLI 平台选择与服务编排的所有权分散问题。此前 `build`、`serve`、`analyze`、`open` 等命令分别依赖 `runMini` / `runWeb` 布尔值，并直接选择 `BuildService` 或 `WebService`。随着 Web、lib、workers、npm 和 IDE 能力继续扩展，这种控制流会让目标解析、执行顺序、资源关闭和能力判断在命令之间重复。

本阶段只建立内部 platform backend contract，不提供第三方 backend 注册 API，也不改变现有配置、日志和构建产物契约。

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

## 后续阶段

### 第二阶段：Module Graph Backend

第二阶段可把 module graph、增量失效和构建图分析收敛为 backend 可消费的稳定接口。它不应改变第一阶段 registry 的目标解析职责，也不应让 driver 绕过 Vite/Rolldown 的 emit/write 阶段。

### 第三阶段：Runtime Provider

第三阶段可为真实宿主、Web runtime 或模拟器建立 runtime provider contract，处理运行时连接、页面状态和调试能力。runtime provider 不等同于 build backend：前者描述产物运行位置与调试通道，后者负责构建目标与生命周期委托。两者应通过明确接口组合，避免重新把 IDE、runtime 和 bundler 所有权混在同一服务中。

## 非目标

- 不开放第三方 backend 注册 API。
- 不新增公开配置项或改变 `weapp.platform` / `weapp.web` 结构。
- 不实现 module graph backend 或 runtime provider。
- 不改变日志文本、输出目录、host metadata 或最终 bundle 内容。
- 不用 `writeFile` 补写、修补或同步最终构建产物。
