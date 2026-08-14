---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `wv prepare` 扫描不含脚本块的 Vue SFC 时误用 JSX 解析模板的问题，纯模板组件现在可以正常生成自动导入与类型支持文件，不再输出相邻 JSX 元素或 Vue 绑定语法解析错误。
