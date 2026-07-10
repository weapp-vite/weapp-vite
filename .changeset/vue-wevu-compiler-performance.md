---
"weapp-vite": minor
"wevu": minor
"@wevu/compiler": minor
"create-weapp-vite": minor
---

升级 Vue SFC 与 Wevu 编译热路径：共享 SFC parse、组件元信息、模板标签和 props 分析结果，为静态 JSON 宏与 defineOptions 提供直接快路径，并在默认关闭 sourcemap 时跳过无用映射生成。连续 HMR、自动导入和多组件页面会减少重复 Vue/Babel 解析；同时修复普通 TypeScript 泛型箭头函数被误判为 JSX，以及路由成功导航后 currentRoute 与 from 状态未及时同步的问题。
