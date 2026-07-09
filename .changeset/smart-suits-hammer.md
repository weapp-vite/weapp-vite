---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态共享 SCSS 依赖变更在 CSS 依赖图尚未完成登记或遇到原子保存 create 事件时可能不刷新产物的问题。现在样式输出阶段会同步登记原始 CSS import 关系，主 HMR watcher 会先同步 CSS 依赖图再计算受影响入口，并在依赖图未命中时回退刷新当前构建范围内的已解析入口，避免共享样式 HMR 空跑。
