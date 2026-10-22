---
"@mpcore/simulator": patch
---

perf(simulator): 在单次同步渲染中复用组件配置与路径解析结果，避免复杂组件树挂载时重复读取产物，并在下一轮渲染重新读取以保留配置更新能力。
