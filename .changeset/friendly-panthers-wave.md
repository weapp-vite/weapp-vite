---
"@mpcore/simulator": patch
---

为 headless testing 节点句柄补充 `tap()` 交互能力，并修复相关类型定义，使测试桥可以直接从渲染节点触发事件并稳定读取 `dataset`。
