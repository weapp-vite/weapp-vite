# @weapp-vite/wxml

保留源码的小程序模板 parser 与 serializer。核心在 Node 和浏览器中运行，不依赖 DOM、文件系统或 JavaScript AST parser。

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

输入方言与输出平台独立。WXML 编译到 Web 仍按 WXML 方言解析，Web 的组件映射、Lit 代码生成和运行时事件由 `@weapp-vite/web` 负责。本包不会自动转换平台指令或执行 WXS、插值表达式。

preserve 模式保留未修改部分，包括 BOM、换行、空白、引号、大小写、重复属性、裸属性、注释、CDATA 和脚本原文。源码范围采用 JavaScript 字符串的 UTF-16 半开区间 `[start, end)`。属性 value 是不含外层引号的词法原文；解码通过 `decodeAttribute(attribute.value, document.syntax, true, attribute.quote)` 显式进行。

第四个参数应传入原属性的 `quote`。legacy 带引号属性统一解开一层宿主转义，包括绑定中的反斜杠和外层引号；返回逻辑绑定源码，不执行 JavaScript 字符串转义。`undefined` 表示无引号属性，保留反斜杠。legacy 实体解码只处理静态片段，绑定中的 `'&amp;'` 保持原文；XML 方言按完整属性值解码实体。输出 quoted legacy 属性时先编码全部反斜杠，再转义外层引号；未转义的外层引号会产生结构诊断。

脚本正文使用独立词法状态识别字符串、正则和注释。少数注释结束边界存在歧义时，调用方可提供 resolveScriptBoundary；语言服务的兼容层可以注入 JS AST 判定，基础入口不会加载 Babel/Oxc。

默认原文标签为 wxs、sjs、ks、filter、script 和 import-sjs，`rawTags` 可替换完整列表。消费者按实际输入平台选择该列表，例如微信自定义 filter 组件与百度 filter 脚本应使用不同配置。边界 resolver 在编辑校验时接收完整最终源码，插入片段另行校验自身的结构平衡。

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
pnpm --filter @weapp-vite/wxml bench
pnpm --filter @weapp-vite/wxml bench:check
```

性能比较分别测量扫描、完整 AST、canonical 序列化及解析编辑输出。默认命令还覆盖构建扫描、Web 和 simulator 的三个正式消费入口。扫描和建树基线使用 htmlparser2，序列化使用 dom-serializer；未修改原文直接输出的快速路径单独报告。

2026-11-03 的正式 v4 基准在 Node 24.22.1 和 headless Chromium 156.0.8078.4 中通过，每个环境的 140 个可比较结果单元全部达标，无错误。`shared` 是双方可直接比较的 354 份真实模板，`real-all` 包含全部 464 份真实模板，不含合成压力用例；两组聚合的候选/基线 P50 比值均要求 ≤1.00，其余分类（含 WXML）要求 ≤1.05。详细结果见[性能报告](https://github.com/weapp-vite/weapp-vite/blob/main/docs/reports/2026-11-03-wxml-parser/README.md)，采样和门禁见[benchmark 说明](https://github.com/weapp-vite/weapp-vite/blob/main/scripts/benchmarkWxmlParser/README.md)。
