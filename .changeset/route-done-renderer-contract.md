---
"@mpcore/simulator": patch
---

fix(simulator): 修正路由动画完成事件的载荷和公开类型，不再提供真实微信运行时未包含的 `renderer` 字段。渲染引擎继续通过路由接受事件观测，使 headless 与浏览器测试能发现误用路由完成事件读取渲染引擎的问题。
