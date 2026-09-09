---
"@mpcore/simulator": patch
---

对齐真实微信 IDE 中 Page 与 Component 实例的 `properties` 数据视图，使自身 data 与 setData 新增或修改的字段可被读取，同时保留组件未声明宿主属性和模板 data 的隔离，以及父级声明属性与 observer 的同步行为。
