# IDE Warning/Error 项目报告：apps/wevu-vue-demo

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`0/1/3/1/0`
- 页面快照：`0`
- 总问题数：`4`
- 普通运行时日志：`1`
- type-uncompatible 命中数：`3`

## 2. 所有 Warning/Error

1. `1` 次：`[runtime/runtime/warn] [Component] property "modelModifiers" of "pages/vue-compat/components/ModelInput" received type-uncompatible value: expected <Object> but got non-object value. Used null instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "modelModifiers" of "pages/vue-compat/components/ModelInput" received type-uncompatible value: expected <Object> but got non-object value. Used null instead.`

2. `1` 次：`[runtime/runtime/warn] [Component] property "tone" of "native/native-meter-ts/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "tone" of "native/native-meter-ts/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

3. `1` 次：`[runtime/runtime/warn] [Component] property "type" of "native/native-badge/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "type" of "native/native-badge/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

4. `1` 次：`[runtime/runtime/error] [wevu] 模板运行时表达式执行失败: __wv_bind_0 = Object.keys(attrs).join(', ') || '(none)' {}`
   - 示例原始行：`[error] [runtime:runtime] [wevu] 模板运行时表达式执行失败: __wv_bind_0 = Object.keys(attrs).join(', ') || '(none)' {}`

## 3. Type-Uncompatible 子集

1. `1` 次：`[Component] property "modelModifiers" of "pages/vue-compat/components/ModelInput" received type-uncompatible value: expected <Object> but got non-object value. Used null instead.`
   - expected: `Object`
   - actual: `got non-object value. Used null instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "modelModifiers" of "pages/vue-compat/components/ModelInput" received type-uncompatible value: expected <Object> but got non-object value. Used null instead.`

2. `1` 次：`[Component] property "tone" of "native/native-meter-ts/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - expected: `String`
   - actual: `get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "tone" of "native/native-meter-ts/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

3. `1` 次：`[Component] property "type" of "native/native-badge/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - expected: `String`
   - actual: `get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "type" of "native/native-badge/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

## 4. Build Stats 样本

1. `ide:wevu-vue-demo-script-setup-emit` -> warn=0 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=3 error=1 exception=0 total=4`

## 6. 普通 Runtime Logs

1. `1` 次：`[runtime/launch-bridge/info] connected=ws://127.0.0.1:59500`
   - 示例原始行：`[info] [runtime:launch-bridge] connected=ws://127.0.0.1:59500`

## 7. 页面内容快照

- 未采集到页面内容快照。
