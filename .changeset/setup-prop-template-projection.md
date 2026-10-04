---
"@wevu/compiler": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 setup 局部状态与声明 prop 同名时模板读取到宿主属性的问题。编译器通过独立计算字段交付可能冲突的模板绑定，保留父级属性与局部响应式状态各自的更新归属，覆盖导入和展开的 props 声明及循环、插槽局部作用域。
