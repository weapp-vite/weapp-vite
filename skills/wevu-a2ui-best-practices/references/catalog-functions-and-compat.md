# Catalog、函数与兼容层

## Catalog 所有权

消费方提供 A2UI 1.0 catalog JSON；`createA2uiCatalog(document, functionImplementations?, { locale? })` 构建 Core 目录并校验 `protocolVersion === '1.0'`。目录标题、说明、扩展等元数据保留。

`functionImplementations` 中每个名称必须已在 catalog 声明。构造阶段立即拒绝未知名称；只读取对象自身属性，`toString` 等继承成员不会成为实现。

## 函数优先级

宿主实现优先于内置标准函数；两者都没有实现时保留 schema-only 声明。运行时调用 schema-only 函数通过 `onError` 报告，不执行模型代码。

内置函数：

- 基础校验：`required`、`regex`、`length`、`numeric`、`email`。
- 逻辑：`and`、`or`、`not`。
- 格式化：`formatString`、`formatNumber`、`formatCurrency`、`formatDate`、`pluralize`。
- 协议系统函数：`@index` 由 Core 提供。

内置实现只有在返回类型、参数 schema、调用方与用户激活约束均兼容时启用。`locale` 仅支持 `zh-CN` / `en-US`，默认中文；不依赖 `Intl`。`formatDate` 保留写入的 wall-clock 字段，ISO 对应 UTC instant；中文复数使用 CLDR `other`。`openUrl` 与未启用能力由宿主按平台实现。

## 宿主函数

```ts
const options = {
  functionImplementations: {
    async format(args: Record<string, unknown>) {
      return String(args.value)
    },
  },
}
```

宿主函数只接收已校验的参数字典，不接收 Core `DataContext` 或 `AbortSignal`。因此 `dispose()` 不会取消已经启动的异步函数；宿主需自行持有取消机制，并在回调前检查会话是否仍有效。

## 显式兼容层

`createA2uiCatalog` 会在进入 Core 前调用 `installA2uiRuntimeCompat()`。如需独立使用 Core，可显式调用同一导出。

兼容层只补齐：

- `Object.hasOwn`
- `AbortController`
- `AbortSignal`

宿主已提供的内建保持不变，重复安装无副作用。它不补 `Intl`、浏览器 DOM、lit、RPC 或动态模板能力，也不是绕过小程序宿主安全策略的通用 shim。

## 边界

- 所有消息和 catalog 按外部输入校验；不要用 `as any` 跳过协议。
- 不在 AppService 使用 `eval`、`new Function` 或模型返回的可执行代码。
- 未声明组件、函数或扩展先报错/展示兜底，不静默执行未知行为。
- 外部函数权限仍由宿主控制；“内置标准函数”不等于可访问设备、网络或账号能力。
