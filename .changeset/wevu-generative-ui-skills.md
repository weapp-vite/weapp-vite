---
"@wevu/json-render": minor
"@wevu/a2ui": minor
"weapp-vite": minor
"wevu": minor
"@weapp-vite/react": minor
"create-weapp-vite": patch
---

feat(skills): 为 `@wevu/json-render` 与 `@wevu/a2ui` 增加随 npm 包分发的实践 skills，分别覆盖 json-render 会话、SpecStream 与预编译组件接入，以及 A2UI 1.0 surface、投影交互与递归宿主。全部六个包专属消费 skill 改为直接维护在 owner 包内并随同一目录发布，删除根分发清单、构建与 prepack 同步、生成目录和专属 Turbo 恢复任务；校验、本地链接、发布归属、触发回归与文档改为发现包内唯一源。`@wevu/json-render-components` 的使用指南归入 json-render 技能而不重复分发。
