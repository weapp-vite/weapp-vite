---
title: "@weapp-vite/language-service"
description: CLI 与 VSCode 共用的小程序语言内核，提供多平台模板、脚本模块的分析、源码编辑与结构化诊断。
keywords:
  - language-service
  - WXML
  - AXML
  - WXS
  - SJS
  - VSCode
---

# @weapp-vite/language-service

这个包集中维护小程序源码范围、平台 profile、模板作用域、脚本模块引用和结构化诊断。CLI 与 VSCode 复用相同分析结果；文件系统、配置执行和编辑器协议分别放在适配层，语言内核不执行用户脚本。

## 支持范围

| 类别 | 登记范围 |
| --- | --- |
| 模板 | WXML、AXML、TTML、SWAN、JXML、QML、KSML、XHSML、TYML |
| 样式 | WXSS、ACSS、TTSS、QSS、JXSS、TYSS 和平台原生 CSS |
| 脚本模块 | 独立与内联 WXS、SJS、快手 KS、百度 filter |
| 编译源文件 | `lang="ts/js"`、`.wxs.ts` / `.wxs.js`、`.sjs.ts` / `.sjs.js`、`.ks.ts` / `.ks.js`、`.filter.ts` 等 |

核心六平台复用已有构建平台注册信息；QQ、快手和涂鸦维护独立语言 profile，不扩展构建平台联合类型。指令、事件、模块系统和内置组件数据分别记录官方来源。组件快照由仓库脚本生成并离线发布；覆盖范围以清单和来源记录为准，不把微信组件数据当成其他宿主的默认值。

“全部覆盖”只表示公开支持矩阵内的场景均已实际执行通过，不表示任意未来语法都正确。矩阵缺项、跳过或未执行都不能记作通过。

## 分析接口

```ts
import { analyzeDocument, analyzeScript, analyzeTemplate } from '@weapp-vite/language-service'

const template = analyzeTemplate({
  source: '<view a:for="{{ rows }}" a:for-item="row">{{row.title}}</view>',
  fileName: 'src/page.axml',
})

const script = analyzeScript({
  source: 'var value = 1; module.exports = { value: value };',
  fileName: 'src/tools.wxs',
  platform: 'weapp',
})

const document = analyzeDocument({ source, fileName: 'src/page.ttml' })
```

模板分析返回 token、元素、循环作用域与绑定、表达式、模板及模块引用。脚本分析返回模块依赖与绑定/引用/公开导出的源码区间。`Diagnostic` 使用 UTF-16 的 `start` / `end`、稳定 `code`、`message` 和 `error` / `warning` / `info`；CLI 行列与 VSCode Range 从同一偏移转换。

这些结果供编辑器实现补全、悬浮、定义、引用和重命名，包含循环遮蔽、事件参数、内联/外置模块与命名模板。它们不构成完整模板类型检查器。

`getScriptTemplateExports` 把模板访问路径映射到源码导出作用域。编译为 CommonJS 时，仅有默认对象的模块使用 `tools.value`；命名与默认导出混合时，`tools.value` 对应命名导出，`tools.default.value` 对应默认对象成员。静态 `import` / `require`、别名和解构通过同一导出身份导航及安全重命名；无法确认宿主混合导出映射时返回歧义状态，不猜选同名成员。

## 安全格式化

`formatTemplate` 使用共享 scanner 和源码片段编辑，仅调整标签/属性布局；文本、实体、属性值及引号、顺序、重复属性和闭合形式均受保护。脚本模块通过 `formatScript` 的平台词法兼容层调用格式器，并在格式化后复验方言和 AST。

需要完整项目默认配置、内联模块和样式格式化时，使用 `@weapp-vite/oxfmt/languages` 的 `formatDocument`；已有 `@weapp-vite/oxfmt/wxml` 的 `formatWxml` API 保持兼容。语法、结构或语义不可靠时抛出结构化错误，由编辑器返回零编辑，由 CLI 在写入前终止。

## 项目适配

`@weapp-vite/language-service/project` 提供项目配置加载、文件收集、模块归属解析及诊断输出。VSCode 只在受信任工作区加载项目工具；无项目工具时可使用纯 TS 模板分析和格式化，不打包平台 native 格式器。

平台配置见 [`weapp.language`](/config/language)。Oxlint 继续负责标准 JS/TS/Vue 脚本，组合 CLI 补齐原生语言；Vue parser services 规则保留 ESLint，样式语义保留 Stylelint。此次适配的验收范围为 TS、CLI、VSCode 和构建，未执行真实小程序 IDE runtime 验收。

相关文档：[Oxlint](/packages/oxlint)、[Oxfmt](/packages/oxfmt)、[创建项目](/packages/create-weapp-vite)。
