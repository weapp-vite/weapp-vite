---
'@weapp-vite/language-service': minor
'@weapp-vite/oxlint': minor
'@weapp-vite/oxfmt': minor
'@weapp-vite/vscode': minor
'@weapp-core/shared': patch
'@wevu/compiler': patch
'weapp-vite': minor
'create-weapp-vite': minor
---

feat(create-weapp-vite): 为多平台模板、样式与脚本模块提供统一的语言诊断、格式化和编辑器能力。

新增共享语言内核，统一九种模板语言、原生样式和 WXS/SJS/KS/filter 的平台归属、作用域及模块引用。项目通过 `weapp.language` 配置按文件覆盖；CLI 与 VSCode 复用同一份离线平台资料和分析结果，提供语法与平台限制诊断、补全、悬浮、跳转、引用和重命名，不新增完整模板类型检查器。

格式化保留模板文本、属性值、实体、引号、顺序与显式闭合形式，原生脚本采用方言校验与 AST 等价保护；全部候选文件通过检查后才写入，源码变化或非法输入会拒绝覆盖。保留 `formatWxml` 入口，新增通用格式化与组合 lint 命令。生成项目同步多平台文件关联、唯一格式化提供者和检查脚本，Wevu 保留专项 ESLint，Stylelint 扩大原生样式范围。

构建的脚本模块格式与标签属性按平台描述统一处理，修正抖音 SJS 的 CommonJS 输出和百度 import-sjs 的 src/module 属性。支持范围以公开矩阵与静态、CLI、VSCode host、构建回归为准，不代表已完成真实小程序 IDE runtime 验收。
