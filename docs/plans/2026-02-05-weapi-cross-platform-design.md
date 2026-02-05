# Weapi 跨平台 API 设计

## 背景与目标

`packages/weapi` 需要提供微信小程序全量 API 的跨平台封装，并兼容其它主流/长尾平台（支付宝/百度/字节/QQ/快应用/京东/小红书/快手/淘宝等）。对外推荐 Promise 风格，但必须兼容传统回调风格。默认导出短名称 `wpi`，同时提供 `createWeapi` 以便显式注入平台适配器。

## 方案选择

采用“动态代理 + promisify”方案：

- 运行时用 `Proxy` 转发任意方法名到当前平台对象，实现“全量 API”覆盖。
- Promise 风格作为推荐默认；回调风格兼容并透传到原生实现。
- 类型上提供基础索引签名 + 少量已知扩展，后续可增量补齐。

选择理由：保证全量可用、维护成本低、平台新增 API 可立即生效。

## 对外 API 与导出

- `wpi`: 默认实例，自动探测平台对象（`wx/my/tt/qq/swan/ks/jd/...`）。
- `createWeapi({ adapter? })`: 创建新实例，可显式注入平台对象。
- `wpi.setAdapter(adapter)` / `wpi.getAdapter()` / `wpi.platform`: 便于运行时切换与调试。

## Promise/回调规则

- **仅当不传回调时返回 Promise**。
- 若参数对象包含 `success`/`fail`/`complete` 任一字段：视为回调风格，直接透传调用并返回原生返回值。
- Promise 风格：内部注入 `success/fail/complete`，以 resolve/reject 统一结果。
- 同步 API（`*Sync`）与事件 API（`onXxx`）不包 Promise，直接返回原生值。

## 平台检测与适配

默认按以下顺序探测全局对象并缓存：`wx → my → tt → qq → swan → ks → jd → ...`。
`createWeapi` 支持显式传入 adapter；`setAdapter` 可动态切换。
暂不做强制参数适配或行为统一，仅做转发；后续可引入 patch 表做差异修正。

## 缺失 API 处理

采用宽松策略：

- 回调风格：触发 `fail`（若有）并调用 `complete`，返回 `undefined`。
- Promise 风格：返回 rejected Promise，错误信息包含平台与方法名。

## 文件结构建议

```
packages/weapi/src/
  index.ts              # 导出 wpi / createWeapi
  core/
    createWeapi.ts       # 工厂与代理逻辑
    adapter.ts           # 平台检测与适配器接口
    promisify.ts         # Promise/回调封装
    utils.ts             # 辅助函数
```

## 测试与验证

- 运行时：在各平台模拟/单测中验证 Promise 与回调两种调用路径。
- 缺失 API：验证 fail/reject 行为。
- 同步/事件 API：确保不被 Promise 包装。
- 平台探测：多平台全局对象的优先级与覆盖行为。

## 后续演进

- 逐步补齐常用 API 的类型声明与文档。
- 根据平台差异新增方法级 patch。
