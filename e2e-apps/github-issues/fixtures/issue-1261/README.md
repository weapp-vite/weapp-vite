# Issue #1261：准确投影可能与 prop 冲突的 setup 绑定

`navBar` 从外部模块导入 `Object.freeze({ max: Number })`，使用局部 `haveNext`、`havePrev` 控制翻页按钮。冻结声明的键可确定时，这两个非冲突表达式应保留为直接 WXML 绑定，避免额外生成模板计算字段。

`conflictProbe` 导入冻结的 `canvasId` prop 声明，并使用同名局部 ref；两者仍必须通过独立计算字段保持各自更新。`mutableProbe` 导入运行时由 `Object.assign` 增加 `canvasId` 的可变对象，必须保守保留投影，不能把初始空对象当作完整 prop 列表。

页面提供父级 `max` 和 `canvasId` 更新，覆盖首屏、翻页、父子独立更新及 `reLaunch` 后的初值恢复。目标 runtime suite 位于 `e2e/ide/issue-1261-props-projection.runtime.test.ts`，headless 与真实微信开发者工具复用同一组断言。mpcore 的单测与浏览器用例消费这份 fixture 的真实编译结果。
