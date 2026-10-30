---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
"@mpcore/simulator": patch
---

fix(compiler): 减少无属性冲突时生成的冗余计算状态。

确认不会与 props 冲突的模板变量直接绑定，减少冗余 `computed`；同名 setup 状态保持隔离，无法确定是否安全的声明或导入仍保守处理。

props 声明修改、恢复或重导出变化后，引用组件会重新编译。
