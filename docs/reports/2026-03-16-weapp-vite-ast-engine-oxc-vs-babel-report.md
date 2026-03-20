# weapp-vite AST 引擎切换报告：Oxc vs Babel

## 1. 报告范围

本文基于当前仓库实现，对 `weapp-vite` 在 AST 引擎可切换之后的 `Oxc` 与 `Babel` 做一次全面对比。这里的“对比”不是泛谈两套生态本身，而是聚焦 `weapp-vite` 当前代码里这两套引擎各自承担了什么、已经切到哪一步、哪些模块真正收益、哪些模块仍保留 Babel 语义，以及后续继续推进时的风险与建议。

本报告主要依据以下内容：

- `packages/ast` 的统一 AST 抽象层与操作实现
- `packages/weapp-vite` 对 `ast.engine` 的配置传递、运行时兼容层与测试
- `packages/wevu-compiler` 中已经接入或预留 `astEngine` 的分析路径
- 仓库内现有 benchmark 与说明文档

## 2. 结论先行

### 2.1 一句话结论

`weapp-vite` 当前并不是“完全从 Babel 切到 Oxc”，而是已经完成了“可切换 AST 架构底座 + 部分分析路径切到 Oxc + 运行时 helper 兼容补齐”的阶段。

### 2.2 更准确的工程结论

1. `Babel` 仍然是默认引擎，默认值来自 [`packages/weapp-vite/src/ast/config.ts`](../../packages/weapp-vite/src/ast/config.ts)。
2. `Oxc` 已经可以在若干静态分析场景中实际工作，并且已经接入 `weapp-vite` / `@weapp-vite/ast` / `@wevu/compiler` 的统一调用链。
3. 当前切换收益主要体现在“解析速度更快、轻量分析更适合 Oxc、为后续脱 Babel 做好了边界隔离”。
4. 当前最大的现实限制不是“能不能 parse”，而是“很多历史分析逻辑、语义稳定逻辑和节点工具仍以 Babel AST 为中心”。
5. 因此从项目状态判断，`Oxc` 现在更适合作为“增量替换中的高性能分析后端”，而不是“立即完全替代 Babel 的唯一 AST 基础设施”。

## 3. 切换后的整体架构

### 3.1 关键变化不是 parser 替换，而是抽象层建立

这次 AST 引擎切换最重要的工程动作，不是把某个地方的 `@babel/parser` 替成 `oxc-parser`，而是抽出独立包 [`packages/ast`](../../packages/ast) 作为统一 AST 能力层。

统一入口见 [`packages/ast/src/index.ts`](../../packages/ast/src/index.ts)，统一解析入口见 [`packages/ast/src/engine.ts`](../../packages/ast/src/engine.ts)：

- `parseJsLikeWithEngine(code, { engine })`
- `babelAstEngine`
- `oxcAstEngine`
- 共享 analysis operations

这意味着调用方不再直接依赖“某一个 parser 的细节”，而是依赖一层业务级 operation，例如：

- `collectComponentPropsFromCode`
- `collectScriptSetupImportsFromCode`
- `collectFeatureFlagsFromCode`
- `collectRequireTokens`
- `collectSetDataPickKeysFromTemplateCode`

这层抽象带来的真正收益是：

- 业务调用方切换引擎的成本降低
- 新旧引擎可以并存
- 缓存维度、测试对齐、fallback 策略有统一入口
- 后续继续替换局部实现时，不需要把影响扩散到所有业务模块

### 3.2 当前切换链路

当前链路基本是：

1. `weapp-vite` 读取 `weappViteConfig.ast.engine`
2. 通过 `resolveAstEngine()` 解析为 `'babel' | 'oxc'`
3. 把 `astEngine` 或 `engine` 继续向下传给 AST operation
4. operation 内部决定是真正走 Oxc 后端，还是仅保留统一入口但内部仍走 Babel

这也是为什么当前状态必须区分：

- “调用链支持切换”
- “实现已经真的切到 Oxc”

这两者并不等价。

## 4. Babel 与 Oxc 在 weapp-vite 中的角色定位

### 4.1 Babel 的当前定位

在当前仓库里，`Babel` 仍然承担三类核心角色：

1. 默认兼容引擎
2. 历史 AST 语义稳定基线
3. 需要成熟节点工具链时的主力后端

具体体现包括：

- 默认解析是 Babel：[`packages/ast/src/engine.ts`](../../packages/ast/src/engine.ts)
- `setDataPick` 仍明确保留 Babel 语义：[`packages/ast/src/operations/setDataPick.ts`](../../packages/ast/src/operations/setDataPick.ts)
- `onPageScroll` 性能诊断仍完全基于 Babel AST：[`packages/ast/src/operations/onPageScroll.ts`](../../packages/ast/src/operations/onPageScroll.ts)
- `wevu` page feature 的模块分析仍返回 Babel AST 驱动结果：[`packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts`](../../packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts)
- JSX 深层编译链仍以 Babel 表达式工具为中心：[`packages/wevu-compiler/src/plugins/jsx/compileJsx/analysis.ts`](../../packages/wevu-compiler/src/plugins/jsx/compileJsx/analysis.ts)
- WXS 转换仍直接依赖 Babel transform：[`packages/weapp-vite/src/wxs/index.ts`](../../packages/weapp-vite/src/wxs/index.ts)

### 4.2 Oxc 的当前定位

`Oxc` 当前主要承担四类角色：

1. 可选 AST 解析后端
2. 轻量静态分析后端
3. 性能优化方向上的优先尝试对象
4. 新能力扩展时的优先接入目标

具体体现包括：

- `oxcAstEngine` 使用 `parseSync`：[`packages/ast/src/engines/oxc.ts`](../../packages/ast/src/engines/oxc.ts)
- 若调用方提供了 `parserLike.parse`，Oxc 路径还可复用上层 parser：[`packages/ast/src/engine.ts`](../../packages/ast/src/engine.ts)
- 多个 operation 已经提供 Oxc 实现：`require`、`scriptSetupImports`、`componentProps`、`platformApi`、`featureFlags`、`jsxAutoComponents`
- `weapp-vite` 已经补齐 `@oxc-project/runtime` helper 的 alias / plugin 兼容层：[`packages/weapp-vite/src/runtime/oxcRuntime.ts`](../../packages/weapp-vite/src/runtime/oxcRuntime.ts)

## 5. 当前哪些能力真正支持 Oxc

下面按“已经真正有 Oxc 实现”和“仅支持统一入口但内部未切换”做区分。

### 5.1 已经真正有 Oxc 后端的能力

#### 5.1.1 统一 JS-like 解析

- 文件：[`packages/ast/src/engine.ts`](../../packages/ast/src/engine.ts)
- Oxc 入口：[`packages/ast/src/engines/oxc.ts`](../../packages/ast/src/engines/oxc.ts)

特点：

- Babel 返回 `File`
- Oxc 返回 `Program`
- 通过统一入口把差异封装掉，但调用方若直接依赖节点形状，仍要感知差异

#### 5.1.2 `require.async` 与静态 `require(...)` 预判

- 文件：[`packages/ast/src/operations/require.ts`](../../packages/ast/src/operations/require.ts)

状态判断：

- `collectRequireTokens` 已经基于 Oxc walker 工作
- `mayContainStaticRequireLiteral` 在 `engine === 'oxc'` 时会真实解析并预判
- 若解析失败，则保守返回 `true`

这个策略很典型，代表 Oxc 在 `weapp-vite` 中更多被用于“性能友好的预判和轻量分析”，而不是一上来就承担复杂重写。

#### 5.1.3 `<script setup>` 导入组件分析

- 文件：[`packages/ast/src/operations/scriptSetupImports.ts`](../../packages/ast/src/operations/scriptSetupImports.ts)

状态判断：

- Babel 与 Oxc 都有独立实现
- 仓库内有对齐测试确保结果一致

这是典型适合 Oxc 的场景：结构简单、遍历目标清晰、性能敏感、无需复杂 Babel scope 工具。

#### 5.1.4 组件 `props/properties` 静态提取

- 文件：[`packages/ast/src/operations/componentProps.ts`](../../packages/ast/src/operations/componentProps.ts)

状态判断：

- Babel 与 Oxc 都已经实现
- Oxc 版本额外做了简单的 `bindings` 记录，用于处理 options 对象先赋值再传入的场景
- 目标主要是提取类型映射，不做复杂代码修改

这说明 Oxc 路径已经不只是“扫一眼 import”，而是开始承担一定结构化分析。

#### 5.1.5 平台 API 访问预判

- 文件：[`packages/ast/src/operations/platformApi.ts`](../../packages/ast/src/operations/platformApi.ts)

状态判断：

- `engine === 'oxc'` 时真实解析并查找 `wx` / `my` / `tt` / `swan` / `jd` / `xhs`
- 非 Oxc 路径直接返回 `true`

这表明当前这个 operation 的设计目标并不是“两个后端都做严格分析”，而是“只在 Oxc 路径上做更积极的提前剪枝”。Babel 在这里反而扮演保守兜底。

#### 5.1.6 Feature flag 收集

- 文件：[`packages/ast/src/operations/featureFlags.ts`](../../packages/ast/src/operations/featureFlags.ts)

状态判断：

- Babel 与 Oxc 都有独立实现
- 识别 import 声明与 hook 调用关系
- 适合从 Babel 迁移到 Oxc，因为模式明确、无需复杂 transform

#### 5.1.7 JSX 自动组件分析

- 文件：[`packages/ast/src/operations/jsxAutoComponents.ts`](../../packages/ast/src/operations/jsxAutoComponents.ts)

状态判断：

- Babel 与 Oxc 都已经有实现
- 但 `wevu-compiler` 更深层的 JSX render 编译链仍保留 Babel 工具中心

这里非常关键：自动组件收集是“分析子问题”已经切到 Oxc，但整条 JSX 编译语义链还没有完全脱 Babel。

### 5.2 已经支持统一入口，但内部尚未真正切到 Oxc 的能力

#### 5.2.1 `setDataPick`

- 文件：[`packages/ast/src/operations/setDataPick.ts`](../../packages/ast/src/operations/setDataPick.ts)

代码注释已经明确说明：

- 当前实现先保持 Babel 语义稳定
- `astEngine` 只是为后续 Oxc 分析预留统一入口

也就是说：

- 调用方现在可以传 `astEngine: 'oxc'`
- 但内部实际行为没有切到 Oxc

这是当前最典型的“配置链打通了，但实现未迁移”的场景。

#### 5.2.2 `onPageScroll` 性能诊断

- 文件：[`packages/ast/src/operations/onPageScroll.ts`](../../packages/ast/src/operations/onPageScroll.ts)

状态判断：

- 函数签名接受 `engine`
- 实现里没有分支使用 Oxc
- 整套逻辑依赖 Babel traverse、scope 和 loc 信息

这类“需要更成熟遍历能力、警告定位语义稳定”的分析任务，目前继续留在 Babel 上是合理选择。

#### 5.2.3 `wevu` pageFeatures 外部模块分析

- 文件：[`packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts`](../../packages/wevu-compiler/src/plugins/wevu/pageFeatures/moduleAnalysis.ts)

该文件注释已经写明：

- 当前仍返回 Babel AST 驱动的分析结果
- `astEngine` 目前只用于统一入口与缓存维度

这意味着 Oxc 目前在这条链路上的价值更多是“接口和缓存准备好了”，不是“逻辑已经切换完”。

#### 5.2.4 JSX 编译更深层分析

- 文件：[`packages/wevu-compiler/src/plugins/jsx/compileJsx/analysis.ts`](../../packages/wevu-compiler/src/plugins/jsx/compileJsx/analysis.ts)

状态判断：

- 自动组件分析已经可以走 Oxc
- 但 render 表达式解析、Babel expression helper 仍是核心基础
- 注释也明确写着“先统一调用入口，后续再按 astEngine 拆分真正的 Oxc 分析后端”

## 6. Parser、AST 形状与遍历模型对比

### 6.1 解析入口差异

#### Babel

- 入口主要是 `@babel/parser`
- 在仓库里通过 [`packages/ast/src/babel.ts`](../../packages/ast/src/babel.ts) 统一包装
- 配套有 `traverse`、`types`、`generator`

#### Oxc

- 入口主要是 `oxc-parser.parseSync`
- 遍历通过 `oxc-walker`
- 代码生成测试里使用 `esrap` 做打印基准，而不是 Oxc 自己一体化替代 Babel generator

这意味着当前仓库里：

- Babel 更接近“parse + traverse + types + generate”的完整工具链
- Oxc 更接近“parse + walk + 分析”高性能后端

### 6.2 AST 结构差异

从实现可以直接看到几个典型差异：

1. Babel 根节点常见是 `File`
2. Oxc 根节点常见是 `Program`
3. Babel 字符串字面量常见 `StringLiteral`
4. Oxc 字面量更常见统一 `Literal`
5. Babel 生态里 scope/path/helper 更成熟
6. Oxc 这里更多直接面向原始 node 结构写条件分支

这些差异导致迁移成本主要出现在：

- 节点类型判断
- import/export 结构读取
- member expression 兼容判断
- TypeScript 包装表达式的 unwrap
- 绑定关系与作用域解析

### 6.3 遍历模型差异

#### Babel

优点：

- `NodePath` 能直接拿 scope/binding
- 更适合复杂语义分析、定位、变换
- 历史代码积累多

缺点：

- 对轻量分析来说，工具链较重
- 性能通常不如 Oxc

#### Oxc

优点：

- `walk` 很直接，适合扫描式分析
- 对“找模式”“收集 token”“收集 import”“收集 flag”这类任务更轻

缺点：

- 当前仓库里缺少像 Babel 那样成熟的 path/scope 便利层
- 复杂语义分析往往需要手工维护更多上下文

因此，如果任务是：

- “快速判断有没有某种结构”
- “只读遍历、收集少量信息”

Oxc 更合适。

如果任务是：

- “需要 binding/scope/loc/path”
- “需要复杂变换与错误恢复语义”

Babel 目前仍更稳。

## 7. 性能对比

### 7.1 仓库内已有结论

仓库已有文档 [`packages/weapp-vite/docs/oxc-parser-vs-babel-parser.md`](../../packages/weapp-vite/docs/oxc-parser-vs-babel-parser.md)。

基于 2026-03-15 的本地 benchmark：

- 大文件样本中，`oxc-parser.parseSync` 约快 `7%`
- 中等文件样本中，`oxc-parser.parseSync` 约快 `2x`

更稳妥的结论是：

- 在 `weapp-vite` 当前样本里，Oxc 明显不慢于 Babel
- 且多数情况下更快
- 但速度收益与输入内容强相关，不能简单宣传成固定倍数

### 7.2 为什么当前选择 `parseSync`

仓库另有文档 [`packages/weapp-vite/docs/oxc-parser-sync-vs-async.md`](../../packages/weapp-vite/docs/oxc-parser-sync-vs-async.md)，结论是当前继续使用 `parseSync` 是合理的。

当前实现也确实如此：

- Oxc 引擎直接调用 `parseSync`：[`packages/ast/src/engines/oxc.ts`](../../packages/ast/src/engines/oxc.ts)

这说明项目对 Oxc 的使用是“优先拿吞吐和简单性”，而不是为了异步 API 形式。

### 7.3 性能收益主要落在哪些场景

结合代码实现，当前最可能获得稳定收益的地方是：

- 高频轻量分析
- 大量文件扫描
- import / require / 平台 API / hook / 组件元信息提取
- 需要先做 cheap pre-check 再决定是否进入重逻辑的路径

而对以下场景，性能收益即便存在，也不一定是首要矛盾：

- 复杂 JSX / pageFeatures 语义分析
- 依赖 Babel path/scope 的警告诊断
- WXS 转换
- 需要代码生成或复杂 transform 的路径

## 8. 兼容性与工程稳定性对比

### 8.1 Babel 的兼容性优势

在当前 `weapp-vite` 代码中，Babel 的兼容性优势来自三件事：

1. 历史路径已经被大量使用和验证
2. AST 周边工具齐全
3. 复杂语义逻辑已经沉淀在 Babel helper 上

这也是为什么默认值仍然是 Babel，而不是直接把默认切到 Oxc。

### 8.2 Oxc 的兼容性风险点

当前 Oxc 的风险主要不是“不能解析 TS/JSX”，而是：

1. 节点形状与 Babel 不完全一致
2. 部分分析逻辑需要手工补齐 binding/scope 语义
3. 一些调用方虽然接收了 `astEngine`，但内部逻辑仍依赖 Babel 思维模型
4. 若未来做 transform，helper/runtime 兼容问题会扩大

### 8.3 运行时 helper 兼容已经被单独处理

这次切换里一个很重要但容易被忽略的点，是 `@oxc-project/runtime` helper 的解析兼容已经在 [`packages/weapp-vite/src/runtime/oxcRuntime.ts`](../../packages/weapp-vite/src/runtime/oxcRuntime.ts) 中补上，且有测试覆盖 [`packages/weapp-vite/src/runtime/oxcRuntime.test.ts`](../../packages/weapp-vite/src/runtime/oxcRuntime.test.ts)。

说明项目并不是只做了“编译期 AST 切换”，而是已经意识到：

- 只要 Oxc 参与更深的代码产出路径
- 运行时 helper 解析就是必须解决的问题

这一点非常关键。它提高了 Oxc 后续继续深入的可行性。

## 9. 测试覆盖与可信度评估

### 9.1 当前有哪些测试在保护双引擎行为

仓库里已有多类测试在保护这次切换：

- 引擎入口测试：[`packages/weapp-vite/test/ast/engine.test.ts`](../../packages/weapp-vite/test/ast/engine.test.ts)
- 双引擎结果对齐测试：[`packages/weapp-vite/test/ast/scriptSetupImports.test.ts`](../../packages/weapp-vite/test/ast/scriptSetupImports.test.ts)
- `setDataPick` 跨引擎结果稳定测试：[`packages/weapp-vite/test/ast/setDataPick.test.ts`](../../packages/weapp-vite/test/ast/setDataPick.test.ts)
- Vue transform 配置透传测试：[`packages/weapp-vite/src/plugins/vue/transform/plugin.astEngine.test.ts`](../../packages/weapp-vite/src/plugins/vue/transform/plugin.astEngine.test.ts)
- auto-import metadata 配置透传测试：[`packages/weapp-vite/src/runtime/autoImport/service/metadata.astEngine.test.ts`](../../packages/weapp-vite/src/runtime/autoImport/service/metadata.astEngine.test.ts)
- `packages/ast` 级别的统一行为测试：[`packages/ast/src/index.test.ts`](../../packages/ast/src/index.test.ts)

### 9.2 这些测试说明了什么

这些测试能证明：

- 配置链路已打通
- 关键 operation 已经能在双引擎下给出一致结果
- Oxc helper 兼容层不是纸面设计，而是有落地验证

但这些测试也同时说明：

- 当前保障重点还是“结果一致”和“透传正确”
- 还不是“全链路都已经完全由 Oxc 承担”

## 10. Oxc 与 Babel 的详细对比表

| 维度                | Babel                         | Oxc                      | 当前在 weapp-vite 的判断            |
| ------------------- | ----------------------------- | ------------------------ | ----------------------------------- |
| 默认地位            | 默认引擎                      | 可选引擎                 | Babel 仍是默认、Oxc 是增量替换方向  |
| 解析性能            | 稳定，但通常偏重              | 当前样本中更快           | Oxc 在轻量分析上有明确性能优势      |
| AST 生态完整度      | 很高                          | 当前仓库接入侧偏轻量     | 复杂分析仍更适合 Babel              |
| traverse/scope/path | 成熟                          | 需手工补上下文           | Babel 在复杂语义场景更稳            |
| 轻量静态分析        | 可做，但偏重                  | 很适合                   | Oxc 是更优先选项                    |
| 复杂 transform      | 成熟                          | 当前仓库未形成完整替代链 | Babel 仍是主力                      |
| 代码生成            | `@babel/generator` 已成熟使用 | 当前未形成等价主链       | Babel 更稳                          |
| 运行时 helper 兼容  | 历史成熟                      | 需额外处理               | 已补 `oxcRuntime`，但属于新增维护面 |
| 节点形状一致性      | 与现有逻辑天然一致            | 与 Babel 有差异          | 迁移成本真实存在                    |
| 落地状态            | 全面使用中                    | 部分能力已接入           | 处于“架构已就位，迁移进行中”        |

## 11. 对 weapp-vite 当前阶段的判断

### 11.1 这次切换的真实成果

如果从工程价值看，这次 AST 引擎切换的真实成果主要有五点：

1. 抽出了独立的 AST 共享包，架构边界更清晰。
2. 建立了 `babel/oxc` 双引擎可切换机制。
3. 把多个高频静态分析场景切到了 Oxc。
4. 给 `weapp-vite`、`wevu-compiler`、runtime metadata 等调用方打通了透传链路。
5. 提前解决了 Oxc helper runtime 兼容问题。

这五点的意义，远大于“某一个 benchmark 快了多少”。

### 11.2 当前还不能夸大的地方

当前不宜对外表述为：

- “weapp-vite 已全面切换到 Oxc”
- “Babel 已经不再重要”
- “所有 AST 路径都由 Oxc 驱动”

更准确的说法应该是：

- `weapp-vite` 已完成 AST 双引擎架构改造
- Oxc 已在多个静态分析路径投入使用
- 默认兼容模式仍是 Babel
- 若继续推进，可以逐步把更多分析从 Babel 迁移到 Oxc

## 12. 后续建议

### 12.1 短期建议

1. 保持默认值仍为 `babel`，不要过早切默认。
2. 优先继续迁移“只读分析、结构稳定、无需复杂 scope”的 operation。
3. 针对每个 operation 明确标注状态：
   - 已真实切到 Oxc
   - 仅统一入口
   - 仅缓存/配置透传
4. 补更多真实业务样本 benchmark，而不是只看合成场景。

### 12.2 中期建议

1. 选择一条中等复杂度但价值高的分析链路，完整迁到 Oxc，验证维护成本。
2. 建立更系统的双引擎等价测试矩阵。
3. 为 Oxc 侧补一层更通用的 node helper / binding helper，减少各 operation 手工写节点兼容分支。

### 12.3 长期建议

如果目标是未来让 Oxc 成为默认甚至主引擎，需要至少完成：

1. `setDataPick` 的真正 Oxc 化
2. pageFeatures 模块分析从 Babel AST 迁出
3. JSX 深层分析链中对 Babel expression helper 的替代方案
4. 更完整的 runtime/helper/output 兼容验证
5. 大规模真实项目回归

## 13. 最终结论

从当前仓库事实出发，`weapp-vite` 的 AST 引擎切换已经取得了明确进展，但它的完成度应定义为“完成了双引擎架构与部分 Oxc 实战落地”，而不是“已经彻底从 Babel 切换到 Oxc”。

如果只看性能，Oxc 的方向是对的；如果看整体工程成熟度，Babel 仍然是当前更完整、更稳的基线；如果看未来演进空间，Oxc 已经是 `weapp-vite` 最值得继续投入的 AST 分析后端。

换句话说：

- `Babel` 代表当前的稳定基线
- `Oxc` 代表未来的性能与架构演进方向
- `weapp-vite` 当前最成功的地方，不是二选一，而是已经把两者放进了一个可持续演进的统一框架里
