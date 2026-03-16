# weapp-vite AST 热路径 Oxc 化阶段报告

## 1. 报告目标

本文聚焦一个更具体的问题：

- 在保留 `ast.engine = 'babel' | 'oxc'` 双实现前提下
- 针对 `dev / HMR` 真正高频命中的 AST 热路径
- 当前已经完成了哪些 Oxc 化改造
- 本地 benchmark 的收益和瓶颈分别是什么

这份报告不是全量编译链结论，而是面向“开发体验优化”的阶段性结果。

## 2. 已完成的热路径改造

### 2.1 `setDataPick`

文件：

- [packages/ast/src/operations/setDataPick.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/ast/src/operations/setDataPick.ts)

现状：

- 已从“统一入口但只有 Babel 语义”改为真正的 Babel/Oxc 双实现
- Oxc 分支补齐了模板表达式里的作用域识别
- 针对 `map((item, index) => ...)` 等局部变量场景补了等价测试

### 2.2 `onPageScroll` 诊断

文件：

- [packages/ast/src/operations/onPageScroll.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/ast/src/operations/onPageScroll.ts)

现状：

- 已补上 Oxc 分支
- 覆盖对象方法、对象属性、函数式 `onPageScroll(...)` 三类入口
- 语义覆盖：
  - 空回调检测
  - `setData` 检测
  - `wx.*Sync` 检测
  - 跳过嵌套函数体

### 2.3 `pageFeatures / moduleAnalysis`

文件：

- [packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts)

现状：

- `createModuleAnalysisFromCode(..., { astEngine: 'oxc' })` 已走真正 Oxc 结构化分析
- 外部模块缓存已按引擎隔离
- 新增 page-module 通用分析缓存
- Oxc 解析文件名现在使用真实模块 id 的扩展名，不再固定为 `inline.ts`
- 对无模块语法源码增加空分析快速返回

### 2.4 `pageFeatures / optionsObjects`

文件：

- [packages/wevu-compiler/src/plugins/wevu/pageFeatures/optionsObjects.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/wevu-compiler/src/plugins/wevu/pageFeatures/optionsObjects.ts)

现状：

- `astEngine = 'oxc'` 时，先做文本预判和 `ModuleAnalysis` 预判
- 对明显无关文件直接快速拒绝，不再进入 Babel parse
- 对需要继续处理的文件，复用统一 `ModuleAnalysis`

### 2.5 `pageFeatures / inject`

文件：

- [packages/wevu-compiler/src/plugins/wevu/pageFeatures/inject.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/wevu-compiler/src/plugins/wevu/pageFeatures/inject.ts)

现状：

- `injectWevuPageFeaturesInJsWithResolver` 现在先走统一 `collectTargetOptionsObjectsFromCode`
- 无关文件可直接快速返回
- 相关文件可复用 page module 的 `ModuleAnalysis`

## 3. benchmark 入口

本轮新增/更新：

- [packages/weapp-vite/bench/ast-hot-paths.bench.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/weapp-vite/bench/ast-hot-paths.bench.ts)
- [packages/weapp-vite/bench/ast-comparison.bench.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/weapp-vite/bench/ast-comparison.bench.ts)

执行命令：

```bash
pnpm -C packages/weapp-vite bench
```

最新结果文件：

- [packages/weapp-vite/bench/results/1773667743624.json](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/weapp-vite/bench/results/1773667743624.json)

## 4. 关键 benchmark 结果

### 4.1 已见正收益的热路径

#### `setDataPick`

- Babel: `18.78 hz`
- Oxc: `19.94 hz`
- Oxc 约快 `6.2%`

#### `onPageScroll warnings`

- Babel: `162.59 hz`
- Oxc: `170.03 hz`
- Oxc 约快 `4.6%`

#### `optionsObjects unrelated (cold)`

- Babel: `109.30 hz`
- Oxc fast reject: `1,631,014.26 hz`

这是当前最明显的收益点，说明：

- 对大量与 wevu pageFeatures 无关的源码
- 只要能在文本预判 / 轻量分析阶段直接拒绝
- `dev / HMR` 的增量分析成本可以下降几个数量级

### 4.2 当前仍未跑赢 Babel 的热路径

#### `moduleAnalysis (cold)`

- Babel: `1192.64 hz`
- Oxc: `706.42 hz`
- Oxc(js id): `809.14 hz`

这里 Oxc 仍明显慢于 Babel。

## 5. 瓶颈拆分结论

`moduleAnalysis` 已拆成 parse only / analysis only 两段。

### 5.1 parse only

- Babel: `1279.72 hz`
- Oxc: `717.24 hz`
- Oxc(js id): `816.51 hz`

结论：

- 当前这个 fixture 上，Oxc 的瓶颈在 parse
- 用真实 `.js` id 后有改善，但仍未追上 Babel

### 5.2 analysis only

- Babel: `13125.97 hz`
- Oxc: `60039.60 hz`

结论：

- Oxc 分析本身明显更快
- `moduleAnalysis` 没有跑赢 Babel，不是因为 Oxc 分析实现差
- 主要是 parser 成本压过了分析收益

## 6. 缓存收益

### `moduleAnalysis (cached)`

- Babel: `7,692,480.96 hz`
- Oxc: `8,785,669.52 hz`

结论：

- 一旦进入缓存命中路径，Oxc 并不吃亏
- 对开发态而言，真正该做的是：
  - 减少不必要 parse
  - 提高同轮更新里的分析复用率
  - 提高无关文件快速拒绝比例

## 7. 当前阶段结论

本轮改造支持一个比较明确的工程判断：

1. 对 `dev / HMR`，Oxc 的价值已经开始体现，但主要体现在“分析前置优化”而不是“所有冷路径 parse 都更快”。
2. 当前最有效的路线不是继续强推每个冷路径都用 Oxc parse 跑赢 Babel，而是：
   - 文本预判
   - 快速拒绝
   - 同轮分析缓存
   - 统一 `ModuleAnalysis` 复用
3. `moduleAnalysis` 仍是当前主要瓶颈，但问题已经被定位为 parser 层，而不是分析层。

## 8. 下一步建议

### 8.1 应继续做

1. 在 pageFeatures 上游继续扩大 `ModuleAnalysis` 复用范围
2. 继续扩大“无关文件快速拒绝”覆盖面
3. 对更多真实 app 记录 `dev/HMR` 端到端数据，验证这些热路径优化是否已反映到用户体感

### 8.2 暂不建议优先做

1. 为了追求全链路统一而强行把复杂 rewrite/codegen 全量切到 Oxc
2. 在 `moduleAnalysis` 分析循环内部继续抠微优化

原因：

- 当前 benchmark 已证明主要瓶颈不在分析循环
- 更高收益的方向仍然是减少 parse 次数

## 9. 附：本轮重点文件

- [packages/ast/src/operations/setDataPick.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/ast/src/operations/setDataPick.ts)
- [packages/ast/src/operations/onPageScroll.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/ast/src/operations/onPageScroll.ts)
- [packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts)
- [packages/wevu-compiler/src/plugins/wevu/pageFeatures/optionsObjects.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/wevu-compiler/src/plugins/wevu/pageFeatures/optionsObjects.ts)
- [packages/wevu-compiler/src/plugins/wevu/pageFeatures/inject.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/wevu-compiler/src/plugins/wevu/pageFeatures/inject.ts)
- [packages/weapp-vite/bench/ast-hot-paths.bench.ts](/Users/yangqiming/Documents/GitHub/weapp-vite/packages/weapp-vite/bench/ast-hot-paths.bench.ts)
