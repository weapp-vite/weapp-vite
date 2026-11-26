---
'create-weapp-vite': patch
'weapp-vite': patch
---

fix(weapp-vite): 修复自动模式下未使用 WebSocket 仍被注入的问题。`app.prelude` 与框架 request globals 运行时块只提前安装依赖命中的目标集合，并且不再把框架 polyfill 自身文本当作业务使用线索；普通请求依赖仍按产物实际使用情况按需注入，`targets` 候选集合保持全量以维持其他 Web 全局对象的识别能力。