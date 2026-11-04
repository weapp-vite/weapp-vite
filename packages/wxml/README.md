# @weapp-vite/wxml

保留源码的小程序模板 parser 与 serializer。核心在 Node 和浏览器中运行，不依赖 DOM、文件系统或 JavaScript AST parser。

`0.1.0-alpha.1` 已通过共享 `Release`（`release.yml`）单包 bootstrap 与 GitHub Actions OIDC 发布，registry 确认、原 tarball 核对、隔离入口与严格类型检查、npm 签名验证全部通过。安装使用 `npm install @weapp-vite/wxml@alpha`，固定复现使用 `npm install @weapp-vite/wxml@0.1.0-alpha.1`。`alpha` 指向 alpha.1，`latest` 保持 alpha.0；正式版继续使用仓库 changeset 发布流程。

维护者入口见[单包 bootstrap](https://github.com/weapp-vite/weapp-vite/blob/main/docs/repoctl-release.md#单包-bootstrap)，本次真实发布及来源见[通用入口验收](https://github.com/weapp-vite/weapp-vite/blob/main/docs/repoctl-release.md#通用入口验收)。首版 alpha.0 的确认超时与只读补验证据保留在[历史记录](https://github.com/weapp-vite/weapp-vite/blob/main/docs/repoctl-release.md#wxml-首版记录)。专用 workflow、辅助脚本和旧 npm Trusted Publisher 均已移除，回读确认仅保留状态为 `Valid` 的 `release.yml` 连接；npm 初始化的 `0.0.0-stage` 仅为占位版本。

```ts
import { edit, parse, serialize, walk } from '@weapp-vite/wxml'

const document = parse('<view title="before">{{ message }}</view>')
const updated = edit(document, (handle) => {
  if (handle.node.kind === 'element') {
    handle.setAttribute('title', 'after')
    handle.setAttribute('hidden', { expression: '!visible' })
  }
})

console.log(serialize(updated))
walk(updated, {
  enter(node) {
    console.log(node.kind, node.start)
  },
})
```

## 接口

- `scan(source, options)` 返回 tokens 与 diagnostics，保留标签、属性、脚本和文本的源码范围。
- `parse(source, options)` 返回带有 children、tokens、diagnostics 和原始 source 的文档。
- `walk(document, visitor)` 同步先序遍历；enter 返回 false 时跳过子节点。
- `edit(document, visitor)` 在同步编辑会话中修改，返回新文档；不会修改输入文档。
- `serialize(document, { mode })` 输出模板源码。默认 preserve；canonical 会遍历树并统一标签和属性标点，不处理缩进、折行或压缩。

节点和属性使用只读 TypeScript 接口，AST 不做运行时深冻结。JavaScript 调用方同样应通过 `edit` 修改；直接改写节点不受支持。

通过编辑句柄的 setAttribute、setBooleanAttribute、removeAttribute、rename、replaceText、remove、replaceWith、insertBefore、insertAfter、prepend 和 append 登记修改；会话结束后句柄失效。属性 setter 替换首个同名位置并移除其他同名属性，removeAttribute 删除所有同名项。

普通字符串作为字面量编码；`{ expression: 'value' }` 表示单个完整绑定的表达式，不能提前闭合绑定或插入额外节点，number 和 boolean 输出为有类型的绑定值。会话提交时校验最终值，被覆盖或删除的临时值不参与输出。插入或替换的源码片段会按当前文档选项解析校验。非法模板仍可读取诊断，但不能编辑或序列化为可写结果。

编辑同步校验修改。保持结构的属性、普通标签名和非空文本修改复用原树；返回的新文档提供修改后的 source，children/tokens 在首次读取时重建并缓存，walk 和后续 edit 会自动触发。结构、脚本标签或自定义边界 resolver 涉及的修改会立即重新解析完整文档。

## 平台与原文

`platform` 支持 weapp（默认）、alipay、tt、swan、jd、xhs、qq、ks 和 ty。`syntax` 为 legacy 或 xml，默认微信使用 legacy，其他平台使用 xml；显式 syntax 优先。

两种方言都接受引号值后紧接下一属性，例如 `<view a="1"b='2'bare />`；这与微信、支付宝官方编译器的词法结果一致。`syntax` 区分宿主转义与实体等模板规则，不是严格 XML 合规开关。标签名与第一个属性之间仍须分隔。preserve 保留原分隔方式，canonical 为属性输出统一的空白分隔，不承担格式化策略。

输入方言与输出平台独立。WXML 编译到 Web 仍按 WXML 方言解析，Web 的组件映射、Lit 代码生成和运行时事件由 `@weapp-vite/web` 负责。本包不会自动转换平台指令或执行 WXS、插值表达式。

preserve 模式保留未修改部分，包括 BOM、换行、空白、引号、大小写、重复属性、裸属性、注释、CDATA 和脚本原文。源码范围采用 JavaScript 字符串的 UTF-16 半开区间 `[start, end)`。属性 value 是不含外层引号的词法原文；解码通过 `decodeAttribute(attribute.value, document.syntax, true, attribute.quote)` 显式进行。

第四个参数应传入原属性的 `quote`。legacy 带引号属性统一解开一层宿主转义，包括绑定中的反斜杠和外层引号；返回逻辑绑定源码，不执行 JavaScript 字符串转义。`undefined` 表示无引号属性，保留反斜杠。legacy 实体解码只处理静态片段，绑定中的 `'&amp;'` 保持原文；XML 方言按完整属性值解码实体。输出 quoted legacy 属性时先编码全部反斜杠，再转义外层引号；未转义的外层引号会产生结构诊断。

脚本正文使用独立词法状态识别字符串、正则和注释。少数注释结束边界存在歧义时，调用方可提供 resolveScriptBoundary；语言服务的兼容层可以注入 JS AST 判定，基础入口不会加载 Babel/Oxc。

默认原文标签为 wxs、sjs、ks、filter、script 和 import-sjs；`platform: 'jd'` 另外默认识别 jds，`platform: 'qq'` 另外默认识别 qs。这两个平台专有标签不会在其他平台自动变成脚本；`rawTags` 显式传入时仍替换完整列表，包括平台默认值。消费者按实际输入平台选择该列表，例如微信自定义 filter 组件与百度 filter 脚本应使用不同配置。边界 resolver 在编辑校验时接收完整最终源码，插入片段另行校验自身的结构平衡。

当插值已经词法确认结束于 `}}`，但内部括号不匹配时，诊断使用 `template/invalid-interpolation`，并提供只读 `recovery: { kind: 'interpolation', start, end }`，范围包括两侧 mustache。消费者可据此实现自己的错误展示或兼容策略；文档仍有错误，edit 和 serialize 继续拒绝。缺少 `}}`，或字符串、正则、注释、标签结构的边界无法确定时，不提供恢复范围。

## 使用方边界

共享核心已经接入仓库的模板处理入口，各使用方保留自己的语义与兼容层：

| 使用方 | 负责的能力 |
| --- | --- |
| `@weapp-vite/language-service` | XML 词法兼容接口、可变分析结果、平台语义、作用域、格式化及脚本边界的 JS AST 歧义判定 |
| `weapp-vite` | 构建扫描、受控模板变换、doctor 引用检查及 scoped style 输出处理 |
| `@weapp-vite/web` | 输入方言选择、模板编译、字符串模板兼容、表达式执行和 DOM 渲染 |
| `@mpcore/simulator` | 模拟器模板结构、属性、插值和脚本模块消费 |

模拟器在消费层复现实测的引号转义、反斜杠对及其组合；其他转义沿用既有求值行为，尚未确认与真实宿主一致。Web 表达式按标准 JavaScript 执行；核心只处理语法层次与源码范围。

2026-11-03 的验收覆盖微信开发者工具 Stable 2.02.2609240（基础库 3.17.2）和 Web runtime；六平台矩阵验证的是构建。各入口与平台的具体结果见[验收报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-03-wxml-parser/README.md)。

## 验证与性能

```sh
pnpm --filter @weapp-vite/wxml build
pnpm --filter @weapp-vite/wxml test
pnpm --filter @weapp-vite/wxml test:types
pnpm --filter @weapp-vite/wxml test:corpus
pnpm --filter @weapp-vite/wxml test:fuzz
pnpm --filter @weapp-vite/wxml test:coverage
pnpm --filter @weapp-vite/wxml bench
pnpm --filter @weapp-vite/wxml bench:check
```

全平台语料验收离线读取入库的压缩分片、来源、许可和哈希清单。微信、支付宝、百度、抖音、京东、小红书、QQ、快手和涂鸦分别冻结输入平台及 `syntax`、`rawTags`、resolver；其他登记目标使用明确的通用词法配置，不借用平台 ID。uni-app Vue2/Vue3、MPX 和 Taro 固定版本的原生来源、静态上游预期与受控编译产物分别统计，具体版本和目标矩阵见[语料维护说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/templateCorpus/README.md)。模板测试不扩大构建、上传或宿主 runtime 支持范围。

`test:corpus` 对合法语料执行源码范围、scan/parse 一致、逐字往返、canonical 语义与幂等、遍历和编辑后重解析；无效输入检查预期诊断及拒绝不安全输出。公共 XML 子集另与 htmlparser2 差分，平台特有语法依据上游和实际产物证据判断。`test:fuzz` 使用固定种子，正式预算为至少 100,000 个合法组合、100,000 个有明确预期的非法变异和 10,000 条八步编辑序列。相同断言用于源码与 built 入口，完整冻结语料分别在 Node 和 headless Chromium 执行；默认边界解析与 resolver 辅助结果分开报告。

`test:coverage` 以全部生产源码为分母，按原始命中数要求语句、函数、行覆盖率 100%，分支至少 99%，并检查文件清单和逐文件缺口。“100%”只描述冻结输入、登记矩阵或代码分母中的枚举集合，不表示穷尽全网及所有可能输入。数量、许可、框架构建、待调查输入、正确性、覆盖率或性能缺一项都应报告未完成，结果以对应版本的清单和 Node/浏览器报告为准。

**本轮检查点：整体未完成。** `all-platform-v1` 冻结 13,558 份真实内容去重模板、26,228 个来源成员，其中 7,075 份具有真实非微信来源，250 个独立公开上游实际拥有模板来源。元数据另登记 269 个 repo@commit、264 个独立身份，包含仅提供构建输入或证据的来源，不作为真实模板上游配额。

Node 与 headless Chromium 的完整语料各通过 14,584 个用例；两个环境的固定种子测试各完成 100,000 个合法组合、100,000 个明确非法变异及 10,000 条八步编辑序列。24 个生产文件的源码覆盖率为：语句 1,172/1,172、函数 128/128、行 1,139/1,139，均为 100%；分支 1,164/1,171（99.40%），没有 coverage-ignore。当前核心的 464 份正式 v5 性能复验在 Node、Chromium 各通过 140 个速度门禁单元，无错误。新语料独立画像覆盖全部 135 组，在两个环境各完成 10 对预热、40 对正式采样、405 个汇总单元和 22,080 条正式样本；画像完成不表示新增速度门槛通过，不改写旧 464 份门禁的分母。历史失败、等量确认和后续通过报告分别保留。

Taro 4.3.2 Harmony JSUI 的开发、生产两个构建格子仍失败，旧 MPX 安装日志的原始 1,302 字节附件缺失，数量、解析与源码覆盖通过不能替代这两项完整性门禁。逐平台数量、独立验收与原始报告身份见[冻结语料与验收状态](https://github.com/weapp-vite/weapp-vite/blob/main/packages/wxml/test/corpus/README.md)。

采集更新只通过显式维护入口 `pnpm corpus:discover`、`pnpm corpus:collect`、`pnpm corpus:generate` 和 `pnpm corpus:check` 进行；普通测试不搜索 GitHub，也不安装上游依赖。冻结提交、许可审核、恢复、编译证据和完整命令见[语料维护说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/templateCorpus/README.md)。

性能比较分别测量扫描、完整 AST、canonical 序列化及解析编辑输出。默认命令还覆盖构建扫描、Web 和 simulator 的三个正式消费入口。扫描和建树基线使用 htmlparser2，序列化使用 dom-serializer；未修改原文直接输出的快速路径单独报告。

本轮正式 v5 基准在 Node 与 headless Chromium 各通过 140 个可比较结果单元，0 错误。此前 Node `wxml-script` 的失败（首次 1.082、等量确认 1.117）与优化后通过的 v5（Node 1.046、Chromium 0.901）分别保留，历史失败未被覆盖。`shared` 是双方可直接比较的 354 份真实模板，`real-all` 包含全部 464 份真实模板，不含合成压力用例；既有分母保持不变，新增全平台语料另设版本和画像。
