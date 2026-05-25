# IDE Warning/Error 项目报告：apps/tdesign-miniprogram-starter-retail

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`1/0`
- runtime log/info/warn/error/exception：`2/1/2/0/0`
- 页面快照：`0`
- 总问题数：`3`
- 普通运行时日志：`3`
- type-uncompatible 命中数：`2`

## 2. 所有 Warning/Error

1. `2` 次：`[runtime/runtime/warn] [Component] property "label" of "miniprogram_npm/tdesign-miniprogram/tab-panel/tab-panel" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "label" of "miniprogram_npm/tdesign-miniprogram/tab-panel/tab-panel" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

2. `1` 次：`[build/build/warn] [warn] [分包] 模块 pages/order/common.js 同时被主包引用，因此仍保留在主包 common.js，并复制到 pages/goods，请确认是否需要将源代码移动到主包或公共目录。`
   - 示例原始行：`[warn] [build:build] [warn] [分包] 模块 pages/order/common.js 同时被主包引用，因此仍保留在主包 common.js，并复制到 pages/goods，请确认是否需要将源代码移动到主包或公共目录。`

## 3. Type-Uncompatible 子集

1. `2` 次：`[Component] property "label" of "miniprogram_npm/tdesign-miniprogram/tab-panel/tab-panel" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - expected: `String`
   - actual: `get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "label" of "miniprogram_npm/tdesign-miniprogram/tab-panel/tab-panel" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

## 4. Build Stats 样本

1. `ide:tdesign-retail-runtime` -> warn=1 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=2 info=0 warn=2 error=0 exception=0 total=2`

## 6. 普通 Runtime Logs

1. `2` 次：`[runtime/runtime/log] 版本信息 {"hasUpdate":false}`
   - 示例原始行：`[log] [runtime:runtime] 版本信息 {"hasUpdate":false}`

2. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:56205`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:56205`

## 7. 页面内容快照

- 未采集到页面内容快照。
