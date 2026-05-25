# IDE Warning/Error 项目报告：e2e-apps/wevu-subpackage-placement

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`0/1/0/1/0`
- 页面快照：`0`
- 总问题数：`1`
- 普通运行时日志：`1`
- type-uncompatible 命中数：`0`

## 2. 所有 Warning/Error

1. `1` 次：`[runtime/runtime/error] [wevu] 模板运行时表达式执行失败: __wv_bind_0 = getDouble() {}`
   - 示例原始行：`[error] [runtime:runtime] [wevu] 模板运行时表达式执行失败: __wv_bind_0 = getDouble() {}`

## 3. Type-Uncompatible 子集

- 未命中 `received type-uncompatible value`。

## 4. Build Stats 样本

1. `ide:wevu-subpackage-placement` -> warn=0 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=0 error=1 exception=0 total=1`

## 6. 普通 Runtime Logs

1. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:59138`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:59138`

## 7. 页面内容快照

- 未采集到页面内容快照。
