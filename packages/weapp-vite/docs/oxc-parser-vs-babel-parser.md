# oxc-parser parseSync 与 Babel Parser 性能对比

本文记录 `oxc-parser@0.119.0` 的 `parseSync` 与 `@babel/parser@7.29.0` 的本地 benchmark 结果。目标是回答一个工程实践问题：在 `weapp-vite` 当前场景里，`oxc-parser` 的同步解析比 Babel 解析快多少。

## 结论

在本仓库当前测试样本中，`oxc-parser` 的 `parseSync` 比 `@babel/parser` 更快，但快多少并不是固定值，而是和输入文件大小、语法结构、AST 形态有关。

本次两组样本的结果是：

- 大文件样本中，`oxc-parser.parseSync` 约快 `7%`
- 中等文件样本中，`oxc-parser.parseSync` 约快 `2x`

因此更稳妥的结论是：

- 在 `weapp-vite` 当前测试场景里，`oxc-parser.parseSync` 明显不慢于 `@babel/parser`
- 经验上可认为它通常更快
- 但不要把某一组 benchmark 的倍数直接外推为所有输入上的固定结论

## 测试环境

- 测试时间：`2026-03-15`
- `oxc-parser` 版本：`0.119.0`
- `@babel/parser` 版本：`7.29.0`
- 运行位置：`packages/weapp-vite`
- 说明：只比较“解析”本身，不包含遍历、生成、转换等后续处理

## Babel 对比基线

为了尽量贴近 `weapp-vite` 当前用法，本次 Babel 测试使用的插件集合与 [src/utils/babel.ts](../src/utils/babel.ts) 中的配置保持一致，并额外包含当前辅助解析里常见的：

- `typescript`
- `decorators-legacy`
- `classProperties`
- `classPrivateProperties`
- `classPrivateMethods`
- `jsx`
- `dynamicImport`
- `optionalChaining`
- `nullishCoalescingOperator`

`oxc-parser` 使用 `parseSync(filename, source)`。

## Benchmark 结果

### 样本一

文件：[src/runtime/autoImport/weappBuiltinHtmlTagsData.ts](../src/runtime/autoImport/weappBuiltinHtmlTagsData.ts)

- 大小：`106058 bytes`
- 每轮迭代：`80`
- 轮数：`7`
- `oxc-parser.parseSync` 平均总耗时：`46.66 ms`
- `@babel/parser.parse` 平均总耗时：`50.01 ms`
- `oxc-parser.parseSync` 中位数总耗时：`45.50 ms`
- `@babel/parser.parse` 中位数总耗时：`48.47 ms`
- 平均值视角下，Babel 约为 Oxc 的 `1.07x`

结论：这个样本中，`oxc-parser.parseSync` 约快 `7%`。

### 样本二

文件：[src/runtime/npmPlugin/builder.ts](../src/runtime/npmPlugin/builder.ts)

- 大小：`22744 bytes`
- 每轮迭代：`80`
- 轮数：`7`
- `oxc-parser.parseSync` 平均总耗时：`20.53 ms`
- `@babel/parser.parse` 平均总耗时：`42.52 ms`
- `oxc-parser.parseSync` 中位数总耗时：`20.64 ms`
- `@babel/parser.parse` 中位数总耗时：`40.83 ms`
- 平均值视角下，Babel 约为 Oxc 的 `2.07x`

结论：这个样本中，`oxc-parser.parseSync` 约快 `2x`。

## 工程判断

如果问题是“在 `weapp-vite` 里应不应该因为性能原因优先选 `oxc-parser.parseSync` 而不是 `@babel/parser`”，那么当前 benchmark 支持这个判断：可以。

但如果问题是“`oxc-parser.parseSync` 一定比 Babel 快几倍”，当前数据不足以支持固定倍数结论。更准确的表达应当是：

- 当前仓库样本下，`oxc-parser.parseSync` 比 `@babel/parser` 快 `7%` 到 `2x`
- 真实收益受输入内容影响明显
- 如果后续要做正式对外表述，建议补充更多真实业务样本，并单独记录平均值、中位数和方差
