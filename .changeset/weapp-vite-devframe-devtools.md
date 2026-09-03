---
"weapp-vite": minor
"@weapp-vite/dashboard": minor
"create-weapp-vite": minor
---

将 `--ui` 调试链路迁移到 Devframe RPC 与 shared state，保留受限文件读取，并把 Dashboard 重构为面向构建、包体、运行事件和诊断的高密度 DevTools 工作台，新增基于 D3 的可缩放 Chunk 静态/动态依赖图，同时修正 mixed vendor 稳定命名、增量模块身份归一化和 WXSS 中的 Vite 资源占位符替换，避免业务依赖被误归属到 `wevu-runtime` 产物、同一依赖因 workspace 与 pnpm 安装路径差异产生虚假增长，以及相对静态资源在最终产物中残留内部占位符。Dashboard 弹出式筛选器改用自有 listbox，统一悬停、选中和展开层视觉，让弹层按照真实视口自动选择上下方向、避让边缘并按选项内容扩展宽度，超长标签则完整换行显示。静态 analyze 模式优先提供已构建 Dashboard 产物，避免本地 dev root 的源码路由在导航时发生动态模块请求失败。
