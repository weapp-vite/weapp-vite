# IDE Warning/Error 项目报告：e2e-apps/wevu-features

## 1. 汇总

- 命令：`node node_modules/vitest/vitest.mjs run -c e2e/vitest.e2e.devtools.config.ts`
- build warn/error：`0/0`
- runtime log/info/warn/error/exception：`0/0/3/0/0`
- 页面快照：`0`
- 总问题数：`3`
- 普通运行时日志：`0`
- type-uncompatible 命中数：`3`

## 2. 所有 Warning/Error

1. `1` 次：`[runtime/runtime/warn] [Component] property "badgeStyle" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "badgeStyle" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

2. `1` 次：`[runtime/runtime/warn] [Component] property "extraLabel" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "extraLabel" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

3. `1` 次：`[runtime/runtime/warn] [Component] property "stateClass" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "stateClass" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

## 3. Type-Uncompatible 子集

1. `1` 次：`[Component] property "badgeStyle" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - expected: `String`
   - actual: `get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "badgeStyle" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

2. `1` 次：`[Component] property "extraLabel" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - expected: `String`
   - actual: `get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "extraLabel" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

3. `1` 次：`[Component] property "stateClass" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`
   - expected: `String`
   - actual: `get null value. Use empty string instead.`
   - 示例原始行：`[warn] [runtime:runtime] [Component] property "stateClass" of "components/use-attrs-feature/index" received type-uncompatible value: expected <String> but get null value. Use empty string instead.`

## 4. Build Stats 样本

1. `ide:wevu-features` -> warn=0 error=0 exit=0

## 5. Runtime Stats 样本

1. `log=0 info=0 warn=3 error=0 exception=0 total=3`

## 6. 普通 Runtime Logs

- 未采集到普通 runtime log。

## 7. 页面内容快照

- 未采集到页面内容快照。
