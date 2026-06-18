---
"weapp-vite": patch
"@weapp-vite/ast": patch
"@weapp-vite/vscode": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

升级 Babel 相关依赖到 8.x，并同步适配 Babel 8 的 AST 与 ESM 导出变化。WXS 转换继续保持 CommonJS/ES5 输出，Vue SFC 编译和 VS Code 扩展中的动态 import、泛型剥离、可选链调用识别、组件宏元数据提取和脚手架依赖目录也同步兼容新的 Babel 行为。
