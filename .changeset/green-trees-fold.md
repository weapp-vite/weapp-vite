---
"weapp-vite": minor
"@wevu/compiler": minor
"create-weapp-vite": patch
---

为 `weapp-vite` 与 `@wevu/compiler` 新增统一的 AST 抽象层，默认继续使用 Babel，并允许在多条纯分析链路中通过配置切换到 Oxc。此次调整同时把组件 props 提取、`usingComponents` 推导、JSX 自动组件分析、`setData.pick` 模板 key 收集、re-export 解析、页面特性分析与部分 emit 阶段快判等能力逐步下沉到可复用的 `ast/operations`，并补充高层配置透传测试，确保 `weapp.ast.engine = 'oxc'` 能从真实插件入口传到对应分析逻辑。
