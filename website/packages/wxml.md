# @weapp-vite/wxml

`@weapp-vite/wxml` 提供保留源码的小程序模板解析、遍历、受控编辑和序列化，在 Node 和浏览器中使用相同核心。

本轮主线已实现 `/core`、`/presets` 与消费者迁移，尚未发布新版本；相对冻结 main 的正式性能仍未验收。下文的历史通过结果不代表本轮候选通过，最新失败证据、正确性检查点和待补项目见[2026-11-05 平台解耦报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-05-template-decoupling/README.md)。

```ts
import { edit, parse, serialize } from '@weapp-vite/wxml'

const document = parse('<view title="before" />', { platform: 'weapp' })
const updated = edit(document, (handle) => {
  if (handle.node.kind === 'element') {
    handle.setAttribute('title', 'after')
  }
})
const output = serialize(updated)
```

## 核心与平台预设

`/core` 没有默认平台，`/presets` 只提供九平台的模板数据。需要自定义方言或复用绑定配置时，可以显式组合：

```ts
import { compileDialect, createParser, edit, serialize } from '@weapp-vite/wxml/core'
import { weapp } from '@weapp-vite/wxml/presets'

const parser = createParser(compileDialect(weapp.dialect))
const document = parser.parse('<view />')
const updated = edit(document, (handle) => {
  if (handle.node.kind === 'element') {
    handle.setBooleanAttribute('hidden')
  }
})
serialize(updated)
```

预设分别登记原生与兼容方言、扩展名、脚本模块、指令和事件。京东可移植 WXS 与原生 JDS 分开；六平台构建白名单继续由构建层维护。`compileDialect` 校验并快照配置，扫描热循环不执行插件回调。

核心文档使用 `TemplateDocument`；根入口 `Document` 继续必含 `platform/options`。编辑、片段验证和延迟物化继承内部解析上下文；展开复制的纯核心文档需要先通过所属 parser 重新解析，再编辑。遍历和序列化仍接受公共结构。

## 解析与序列化

`scan` 提供 tokens 和诊断，`parse` 同时建立 AST。源码范围为 UTF-16 半开区间，保留属性顺序、重复属性、裸属性、引号、文本、注释、CDATA 和脚本正文。

`edit` 通过同步编辑句柄登记变化，返回新文档。`serialize` 默认采用 preserve 模式，未修改区域逐字保留；canonical 模式遍历文档并统一标签和属性标点。格式化策略继续由语言服务和格式器负责。

字符串 setter 表示字面量，表达式使用 `{ expression: 'value' }` 明确传入，必须完整落在单个绑定内。会话提交时校验最终值，被覆盖或删除的临时值不参与输出。无效文档返回诊断，编辑与序列化拒绝错误输入。

节点、属性和源码范围使用只读 TypeScript 接口，AST 不做运行时深冻结。JavaScript 调用方同样应通过 `edit` 修改；直接改写节点不受支持。

属性 `value` 保留不含外层引号的词法原文；需要解码时调用 `decodeAttribute(value, syntax, true, attribute.quote)`。legacy 带引号属性统一解开一层宿主转义，返回逻辑绑定源码，不执行 JavaScript 字符串转义；无引号属性保留反斜杠。legacy 只解静态片段的实体，XML 则对完整属性值解码实体。输出 quoted legacy 属性时先编码全部反斜杠，再转义外层引号。

## 多平台与 Web

平台配置包含微信、支付宝、抖音、百度、京东、小红书，以及 QQ、快手和涂鸦。输入语法由 platform 和可覆盖的 legacy/xml syntax 决定。平台配置不代表对应平台 runtime 已完成验收，实际覆盖以测试及性能报告为准。

微信默认使用 `legacy`，其余平台默认使用 `xml`；显式 `syntax` 优先。`rawTags` 会替换原始脚本标签的完整列表，默认列表为 `wxs`、`sjs`、`ks`、`filter`、`script` 和 `import-sjs`。知道实际输入平台的使用方应选择对应脚本标签，避免把微信普通 `<filter>` 组件当作百度脚本正文。

`platform: 'jd'` 的默认列表另外包含 `jds`，`platform: 'qq'` 的默认列表另外包含 `qs`；其他平台中的同名自定义组件继续按普通模板节点处理。显式 `rawTags` 会替换这些平台默认值，解析与编辑使用同一配置。

两种方言都接受引号值后紧接下一属性，例如 `<view a="1"b='2'bare />`，与微信、支付宝官方编译器的词法结果一致。`syntax` 区分宿主转义与实体等模板规则，不是严格 XML 合规开关；标签名与第一个属性仍须分隔。preserve 保留原文，canonical 为属性输出统一分隔，不承担缩进或折行规则。

Web 是编译目标，WXML 输入仍遵循自己的语法。Web 编译器负责将模板 AST 转为 Lit 渲染代码和 Web 组件，本包负责源码结构、插值及脚本边界。它不会执行脚本，也不自动把微信指令改成其他平台指令。

## 诊断与使用方

缺少 `}}`、未闭合字符串、标签结构破损等边界无法确定的输入会返回错误。只有结束边界已经确定的完整插值，才可能携带 `template/invalid-interpolation` 及只读 `recovery` 范围，供使用方实现错误展示或兼容处理；这不会让错误文档变成可编辑、可序列化的文档。

语言服务保留 XML 词法和可变结果接口，并在脚本边界存在歧义时使用 JS AST 判定。构建层复用 token 范围处理扫描、变换、doctor 引用与 scoped style；Web 和模拟器消费共享结构后继续承担各自运行时语义。基础包不依赖 Babel/Oxc、DOM 或文件系统。

模拟器在消费层复现实测的引号转义、反斜杠对及其组合；其他转义沿用既有求值行为，尚未确认与真实宿主一致。Web 表达式按标准 JavaScript 执行；核心只处理语法层次与源码范围。

2026-11-03 的历史验收覆盖微信开发者工具 Stable 2.02.2609240（基础库 3.17.2）和 Web runtime；六平台矩阵验证的是构建，详见[历史验收报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-03-wxml-parser/README.md)。本轮独立状态见[平台解耦报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-05-template-decoupling/README.md)，factory 修改前的正确性与宿主检查点不代替最终候选复验。

## 离线语料验收

仓库的全平台语料工具冻结提交、来源身份、许可、哈希与解析 profile，按微信、支付宝、百度、抖音、京东、小红书、QQ、快手和涂鸦分别检查。uni-app Vue2/Vue3、MPX、Taro 的固定版本与实际支持目标逐格登记，原生模板、静态上游预期和受控构建产物分别统计；额外模板目标另存身份与配置。完整数量门槛、版本和维护配方见[语料维护说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/templateCorpus/README.md)。

普通验收离线读取入库分片，不在测试期间搜索 GitHub 或执行采集仓库的脚本。修改生产源码后先重建，再执行：

```sh
pnpm --filter @weapp-vite/wxml build
pnpm --filter @weapp-vite/wxml test:acceptance
pnpm --filter @weapp-vite/wxml test:coverage
```

完整冻结语料在 Node 和 headless Chromium 分别检查源码范围、tokens、往返、canonical、遍历和编辑契约；默认边界解析与 resolver 辅助结果分开报告。公共 XML 子集与 htmlparser2 差分，平台语法依据独立上游与编译产物证据判断。固定种子正式组合测试至少执行 100,000 个合法组合、100,000 个明确非法变异及 10,000 条八步编辑序列。源码覆盖率与 built 入口使用相同断言，浏览器结果单独验收。

覆盖率硬门槛是全部生产源码的语句、函数、行 100%，分支至少 99%，按原始命中数判定并核对文件清单。“100%”仅指冻结输入、登记矩阵或代码分母中的枚举集合，不表示穷尽全网或所有可能输入。工具和门槛已经登记不代表结果已通过；数量、许可、框架格子、待调查输入、正确性、覆盖率与性能缺口必须保留，验收以对应清单和报告为准。模板解析结果也不扩大 `weapp-vite` 的构建、上传或 IDE runtime 支持承诺。

**平台解耦前的语料检查点：整体未完成。** `all-platform-v1` 包含 13,558 份真实内容去重模板、26,228 个来源成员、7,075 份具有真实非微信来源的唯一模板，以及 250 个实际拥有模板来源的独立公开上游。269 个 repo@commit、264 个元数据独立身份另行统计，不能把仅提供输入或证据的仓库计入真实模板配额。

Node 与 headless Chromium 的完整语料各通过 14,584 个用例，各完成 100,000 个合法组合、100,000 个明确非法变异和 10,000 条八步编辑序列。源码覆盖包含 24 个生产文件，无 coverage-ignore；语句 1,172/1,172、函数 128/128、行 1,139/1,139 均为 100%，分支 1,164/1,171（99.40%）。该历史检查点的 464 份正式 v5 性能复验在 Node、Chromium 各通过 140 个速度门禁单元，无错误。新语料独立画像覆盖全部 135 组，在两个环境各完成 10 对预热、40 对正式采样、405 个汇总单元和 22,080 条正式样本；画像完成不表示新增速度门槛通过，不改写旧 464 份门禁的分母。历史失败、等量确认和后续通过报告分别保留。

Taro 4.3.2 Harmony JSUI 开发、生产两个构建格子仍失败，旧 MPX 原始 1,302 字节安装日志附件缺失；解析、fuzz、源码覆盖率通过不代表框架矩阵与整体验收通过。完整冻结身份、逐平台数量及独立报告见[冻结语料与验收状态](https://github.com/weapp-vite/weapp-vite/blob/main/packages/wxml/test/corpus/README.md)。

维护者使用 `pnpm corpus:discover`、`pnpm corpus:collect`、`pnpm corpus:generate`、`pnpm corpus:check` 显式更新语料；冻结、许可审核、断点恢复及报告说明集中在[语料维护说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/templateCorpus/README.md)。

## 性能

独立 benchmark 比较扫描、建树、canonical 序列化、解析编辑输出，以及构建扫描、Web、simulator 三个正式消费入口；基线使用 htmlparser2 和 dom-serializer，原文重放单独统计。

平台解耦前的正式 v5 基准在 Node 与 headless Chromium 各通过 140 个可比较结果单元，0 错误。此前 Node `wxml-script` 的失败（首次 1.082、等量确认 1.117）与优化后通过的 v5（Node 1.046、Chromium 0.901）分别保留，历史失败未被覆盖。`shared` 是双方可直接比较的 354 份真实模板，`real-all` 包含全部 464 份真实模板，不含合成压力用例；既有分母保持不变，新增全平台语料另设版本和画像。

可在仓库执行 `pnpm --filter @weapp-vite/wxml bench:check`。上述旧候选的详细结果见[历史性能报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-03-wxml-parser/README.md)，本轮未验收状态见[平台解耦报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-05-template-decoupling/README.md)；采样和门禁见[benchmark 说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/benchmarkWxmlParser/README.md)。

`bench:regression` 与 `bench:regression:check` 另行比较冻结 main 与当前 built 入口；正式模式在 Node、Chromium 各保留 10 对预热和 40 对样本，整体 P50 比例要求 ≤1.03、每类 ≤1.05。原 htmlparser2 命令、策略和历史报告保持独立，不能把两种基线的结论合并。

`bench:regression` 默认 quick，运行 3 个代表组、2 次预热、5 对样本；`bench:regression:check` 执行完整矩阵。精确工作量去重保留 845 个分类结论，将物理测量减少至 603 个任务；原始样本只保存一次，引用关系可核验。CI 的 `test:acceptance` 合并完整语料与 fuzz 准备，root/core × Node/Chromium 的用例数量不变。正式 10/40 预算与门槛保持，检查与待补结论见[本轮交付边界](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-05-template-decoupling/README.md#测试提速与本轮交付边界)。
