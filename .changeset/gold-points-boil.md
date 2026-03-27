---
'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 的 testing bridge 增加组件句柄定位能力，使 headless 测试可以直接按选择器获取组件作用域句柄并读取快照，减少对内部渲染标记的依赖。
