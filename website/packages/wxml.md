# @weapp-vite/wxml

`@weapp-vite/wxml` 提供保留源码的小程序模板解析、遍历、受控编辑和序列化，在 Node 和浏览器中使用相同核心。

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

## 解析与序列化

`scan` 提供 tokens 和诊断，`parse` 同时建立 AST。源码范围为 UTF-16 半开区间，保留属性顺序、重复属性、裸属性、引号、文本、注释、CDATA 和脚本正文。

`edit` 通过同步编辑句柄登记变化，返回新文档。`serialize` 默认采用 preserve 模式，未修改区域逐字保留；canonical 模式遍历文档并统一标签和属性标点。格式化策略继续由语言服务和格式器负责。

字符串 setter 表示字面量，表达式使用 `{ expression: 'value' }` 明确传入，必须完整落在单个绑定内。会话提交时校验最终值，被覆盖或删除的临时值不参与输出。无效文档返回诊断，编辑与序列化拒绝错误输入。

节点、属性和源码范围使用只读 TypeScript 接口，AST 不做运行时深冻结。JavaScript 调用方同样应通过 `edit` 修改；直接改写节点不受支持。

属性 `value` 保留不含外层引号的词法原文；需要解码时调用 `decodeAttribute(value, syntax, true, attribute.quote)`。legacy 带引号属性统一解开一层宿主转义，返回逻辑绑定源码，不执行 JavaScript 字符串转义；无引号属性保留反斜杠。legacy 只解静态片段的实体，XML 则对完整属性值解码实体。输出 quoted legacy 属性时先编码全部反斜杠，再转义外层引号。

## 多平台与 Web

平台配置包含微信、支付宝、抖音、百度、京东、小红书，以及 QQ、快手和涂鸦。输入语法由 platform 和可覆盖的 legacy/xml syntax 决定。平台配置不代表对应平台 runtime 已完成验收，实际覆盖以测试及性能报告为准。

微信默认使用 `legacy`，其余平台默认使用 `xml`；显式 `syntax` 优先。`rawTags` 会替换原始脚本标签的完整列表，默认列表为 `wxs`、`sjs`、`ks`、`filter`、`script` 和 `import-sjs`。知道实际输入平台的使用方应选择对应脚本标签，避免把微信普通 `<filter>` 组件当作百度脚本正文。

Web 是编译目标，WXML 输入仍遵循自己的语法。Web 编译器负责将模板 AST 转为 Lit 渲染代码和 Web 组件，本包负责源码结构、插值及脚本边界。它不会执行脚本，也不自动把微信指令改成其他平台指令。

## 诊断与使用方

缺少 `}}`、未闭合字符串、标签结构破损等边界无法确定的输入会返回错误。只有结束边界已经确定的完整插值，才可能携带 `template/invalid-interpolation` 及只读 `recovery` 范围，供使用方实现错误展示或兼容处理；这不会让错误文档变成可编辑、可序列化的文档。

语言服务保留 XML 词法和可变结果接口，并在脚本边界存在歧义时使用 JS AST 判定。构建层复用 token 范围处理扫描、变换、doctor 引用与 scoped style；Web 和模拟器消费共享结构后继续承担各自运行时语义。基础包不依赖 Babel/Oxc、DOM 或文件系统。

模拟器在消费层复现实测的引号转义、反斜杠对及其组合；其他转义沿用既有求值行为，尚未确认与真实宿主一致。Web 表达式按标准 JavaScript 执行；核心只处理语法层次与源码范围。

2026-11-03 的验收覆盖微信开发者工具 Stable 2.02.2609240（基础库 3.17.2）和 Web runtime；六平台矩阵验证的是构建。各入口与平台的具体结果见[验收报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-03-wxml-parser/README.md)。

## 性能

独立 benchmark 比较扫描、建树、canonical 序列化、解析编辑输出，以及构建扫描、Web、simulator 三个正式消费入口；基线使用 htmlparser2 和 dom-serializer，原文重放单独统计。

2026-11-03 的正式 v4 基准在 Node 24.22.1 和 headless Chromium 156.0.8078.4 中通过，每个环境的 140 个可比较结果单元全部达标，无错误。`shared` 是双方可直接比较的 354 份真实模板，`real-all` 包含全部 464 份真实模板，不含合成压力用例；两组聚合的候选/基线 P50 比值均要求 ≤1.00，其余分类（含 WXML）要求 ≤1.05。

可在仓库执行 `pnpm --filter @weapp-vite/wxml bench:check`。详细结果见[性能报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-03-wxml-parser/README.md)，采样和门禁见[benchmark 说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/benchmarkWxmlParser/README.md)。
