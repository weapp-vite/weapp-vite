# weapp-vite AST 引擎性能对比实测报告：Oxc vs Babel

## 1. 报告目标

本文只回答一个问题：

在 `weapp-vite` 当前仓库与当前环境下，`Oxc` 和 `Babel` 在相同 AST 场景里到底能快多少。

这里不做泛泛而谈，全部结论来自本地实测，并区分为两类：

1. 真实源码文件的 `parse` 对比
2. 同一份合成 AST 样本上的 `parse` / `walk(traverse)` / `print(generate)` 全链路对比

## 2. 测试环境

- 测试时间：`2026-03-16 19:43:21 +0800`
- 系统：`Darwin 25.3.0 arm64`
- Node.js：`v22.20.0`
- `oxc-parser`：`0.120.0`
- `@babel/parser`：`7.29.0`
- `vitest`：`4.1.0`
- 仓库：`weapp-vite`

## 3. 测试方法

### 3.1 真实源码文件对比

测试对象：

1. [`packages/weapp-vite/src/runtime/autoImport/weappBuiltinHtmlTagsData.ts`](../../packages/weapp-vite/src/runtime/autoImport/weappBuiltinHtmlTagsData.ts)
2. [`packages/weapp-vite/src/runtime/npmPlugin/builder.ts`](../../packages/weapp-vite/src/runtime/npmPlugin/builder.ts)

测试配置：

- 每个文件跑 `7` 轮
- 每轮 `80` 次解析
- Oxc 使用 `parseSync(filename, source)`
- Babel 使用 `@babel/parser.parse(source, { sourceType: 'module', plugins: [...] })`

Babel 插件集合与 `weapp-vite` 当前使用方式保持一致：

- `typescript`
- `decorators-legacy`
- `classProperties`
- `classPrivateProperties`
- `classPrivateMethods`
- `jsx`
- `dynamicImport`
- `optionalChaining`
- `nullishCoalescingOperator`

### 3.2 合成 AST 场景对比

输入样本为一份 `require.async()` 密集 JS 文件：

- `1000` 个 `require.async('./mods/mod-xxx.js')`
- 文件大小：`36936 bytes`

对比项目：

1. `parse`
2. `parse + walk/traverse`
3. `walk/traverse only`
4. `parse + print/generate`
5. `parse + walk/traverse + print/generate`
6. `print/generate only`

为了降低单次波动，合成场景统一使用：

- 每个场景 `7` 轮
- 每轮 `40` 次迭代

## 4. 真实源码文件测试结果

### 4.1 样本一：`weappBuiltinHtmlTagsData.ts`

- 文件：[`packages/weapp-vite/src/runtime/autoImport/weappBuiltinHtmlTagsData.ts`](../../packages/weapp-vite/src/runtime/autoImport/weappBuiltinHtmlTagsData.ts)
- 大小：`106058 bytes`
- 每轮：`80` 次解析
- 轮数：`7`

结果：

- Oxc 平均总耗时：`42.20 ms`
- Oxc 中位数总耗时：`42.06 ms`
- Babel 平均总耗时：`59.21 ms`
- Babel 中位数总耗时：`54.03 ms`
- 平均值视角：Babel / Oxc = `1.40x`
- 中位数视角：Babel / Oxc = `1.28x`

结论：

- 在这个大文件样本上，`Oxc parseSync` 比 Babel parse 快约 `28%` 到 `40%`

### 4.2 样本二：`builder.ts`

- 文件：[`packages/weapp-vite/src/runtime/npmPlugin/builder.ts`](../../packages/weapp-vite/src/runtime/npmPlugin/builder.ts)
- 大小：`24482 bytes`
- 每轮：`80` 次解析
- 轮数：`7`

结果：

- Oxc 平均总耗时：`21.42 ms`
- Oxc 中位数总耗时：`21.40 ms`
- Babel 平均总耗时：`59.60 ms`
- Babel 中位数总耗时：`52.39 ms`
- 平均值视角：Babel / Oxc = `2.78x`
- 中位数视角：Babel / Oxc = `2.45x`

结论：

- 在这个中等文件样本上，`Oxc parseSync` 比 Babel parse 快约 `2.45x` 到 `2.78x`

### 4.3 真实源码测试小结

本次两个真实源码文件的 `parse` 结果如下：

| 样本                          |   文件大小 | Oxc 平均总耗时 | Babel 平均总耗时 | Babel / Oxc |
| ----------------------------- | ---------: | -------------: | ---------------: | ----------: |
| `weappBuiltinHtmlTagsData.ts` | `106058 B` |     `42.20 ms` |       `59.21 ms` |     `1.40x` |
| `builder.ts`                  |  `24482 B` |     `21.42 ms` |       `59.60 ms` |     `2.78x` |

当前可以得出的稳妥结论是：

- 在 `weapp-vite` 当前真实源码样本里，`Oxc parseSync` 明显快于 Babel parse
- 本次观测到的加速范围大致是 `1.28x` 到 `2.78x`
- 文件越偏“规则化、可快速扫描”的场景，Oxc 的优势通常越明显

## 5. 合成 AST 场景测试结果

### 5.1 parse only

| 场景    | Oxc 单次平均 | Babel 单次平均 | Babel / Oxc |
| ------- | -----------: | -------------: | ----------: |
| `parse` |  `0.3098 ms` |    `0.6893 ms` |     `2.22x` |

结论：

- 在 `require.async` 密集的合成样本里，单纯解析阶段 Oxc 大约快 `2.12x` 到 `2.22x`

### 5.2 parse + walk/traverse

| 场景                    | Oxc 单次平均 | Babel 单次平均 | Babel / Oxc |
| ----------------------- | -----------: | -------------: | ----------: |
| `parse + walk/traverse` |  `2.0217 ms` |    `5.9154 ms` |     `2.93x` |

结论：

- 当场景从“只 parse”变成“parse 后立即做一次 AST 收集”时，Oxc 优势进一步扩大到约 `2.73x` 到 `2.93x`

### 5.3 walk/traverse only

| 场景                 | Oxc 单次平均 | Babel 单次平均 | Babel / Oxc |
| -------------------- | -----------: | -------------: | ----------: |
| `walk/traverse only` |  `0.2537 ms` |    `1.1861 ms` |     `4.68x` |

结论：

- 在这个“只扫 AST、只提取 token”的场景里，Oxc walker 明显更快
- 本次观测到的优势约 `4.68x` 到 `4.88x`

这对 `weapp-vite` 里那些轻量静态分析 operation 很重要，例如：

- `require` 预判
- import 收集
- hook/flag 收集
- 平台 API 预判

### 5.4 parse + print/generate

| 场景                  | Oxc 单次平均 | Babel 单次平均 | Babel / Oxc |
| --------------------- | -----------: | -------------: | ----------: |
| `parse + esrap print` |  `2.6298 ms` |    `1.0764 ms` |     `0.41x` |

结论：

- 一旦把后续阶段换成 `esrap print` vs `babel generator`，结果反过来
- 在本次样本中，Babel 这一组反而更快

这说明：

- Oxc 的优势主要集中在 `parse` 和轻量分析
- 不能把 “Oxc parse 快” 直接推导成 “整个 parse + print 链路一定更快”

### 5.5 parse + walk/traverse + print/generate

| 场景                            | Oxc 单次平均 | Babel 单次平均 | Babel / Oxc |
| ------------------------------- | -----------: | -------------: | ----------: |
| `parse + walk + print/generate` |  `2.7166 ms` |    `5.7777 ms` |     `2.13x` |

结论：

- 当场景是“先 parse，再做一轮收集，最后生成代码”，整体上 Oxc 仍然更快
- 但优势已经明显小于“只 parse”或“只 walk”

原因很直接：

- Oxc 在前半段赚回来的时间
- 会被 `esrap print` 阶段吃掉一部分

### 5.6 print/generate only

| 场景                  | Oxc 单次平均 | Babel 单次平均 | Babel / Oxc |
| --------------------- | -----------: | -------------: | ----------: |
| `print/generate only` |  `0.6535 ms` |    `0.3603 ms` |     `0.55x` |

结论：

- 就当前这组对比方法而言，`esrap print` 明显慢于 `babel generator`
- 所以如果某条处理链重度依赖“生成代码”，Oxc parse 的优势不会直接转换为全流程优势

## 6. 汇总结论

### 6.1 同样场景下能快多少

按本次实测，可以把结论压缩成下面这几句：

1. 真实源码 `parse` 场景里，Oxc 比 Babel 快约 `1.28x` 到 `2.78x`。
2. 合成 `require.async` 密集场景里，Oxc 的 `parse` 大约快 `2.12x` 到 `2.22x`。
3. 合成轻量 AST 扫描场景里，Oxc 的 `walk` 大约快 `4.68x` 到 `4.88x`。
4. 合成 `parse + walk/traverse` 场景里，Oxc 大约快 `2.73x` 到 `2.93x`。
5. 如果把比较对象扩展到“代码生成”，则 Oxc 优势会明显收缩，甚至在 `print/generate only` 上落后。

### 6.2 对 weapp-vite 的实际含义

对于 `weapp-vite` 当前架构，这些结果意味着：

1. 如果任务是 AST 预判、依赖扫描、hook/flag 收集、组件元信息提取，优先用 Oxc 是合理的。
2. 如果任务是复杂 Babel 语义分析或重度代码生成，不能只看 parser 速度，需要看整条处理链。
3. 当前 Oxc 最有价值的落点，不是“全链路替换 Babel”，而是“优先替换轻量分析路径”。

### 6.3 最稳妥的对外表述

如果要对外总结，不建议说：

- `Oxc` 一定比 Babel 快几倍

更准确的说法应该是：

- 在 `weapp-vite` 当前实测样本中，`Oxc` 在 AST 解析和轻量扫描上明显快于 Babel
- `parse` 阶段大致快 `1.3x` 到 `2.8x`
- 轻量遍历场景大致快 `4.7x`
- 但收益主要集中在解析和分析，不应直接外推到所有包含代码生成的链路

## 7. 本次报告的边界

这份报告有几个边界需要明确：

1. 真实源码样本目前只有两个文件，结论有效，但不代表整个仓库所有文件分布。
2. 合成样本偏向 `require.async` 密集扫描，对 Oxc 友好，适合验证分析路径，不代表所有 transform 场景。
3. `parse + print/generate` 这一组比较，本质上比较的是 `Oxc + esrap` 与 `Babel + generator`，不是纯 parser 对 parser。

因此本报告最适合支持的判断是：

- `weapp-vite` 在 AST analysis 场景下，切 Oxc 能带来可观性能收益

但它不支持直接下结论说：

- `weapp-vite` 所有 AST 相关链路切到 Oxc 后都会整体快同样倍数

## 8. 附：本次实测使用的命令思路

本次数据来自两类本地脚本化实测：

1. 真实源码文件：循环执行 `oxc-parser.parseSync` 与 `@babel/parser.parse`
2. 合成样本：循环执行 `parse` / `walk(traverse)` / `print(generate)` 组合

如果后续要继续扩大样本，建议下一步增加：

- `packages-runtime/wevu-compiler` 里的 JSX/TSX 文件
- `script setup` 密集 SFC 脚本段
- `componentProps` / `featureFlags` / `scriptSetupImports` 这些真实 operation 级 benchmark
