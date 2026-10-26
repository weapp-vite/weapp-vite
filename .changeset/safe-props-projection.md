---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
"@mpcore/simulator": patch
---

fix(compiler): 减少可静态证明无 props 冲突时生成的冗余 computed。安全的局部声明、展开和冻结导入保留直接模板绑定，真正同名的 setup 状态仍使用独立字段；普通可变导入与未知声明继续保守处理。props 分析复用宿主冻结输入并登记依赖，声明修改、恢复和重导出变化后重新编译引用组件。

补充相同 Issue fixture 的 simulator 集成与浏览器回归，验证直接绑定、父子状态隔离和重新进入页面后的状态恢复。
