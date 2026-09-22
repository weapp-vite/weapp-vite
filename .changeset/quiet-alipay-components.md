---
"wevu": patch
"create-weapp-vite": patch
---

修复支付宝 Vue SFC 子组件未执行 setup、computed 不渲染及 emit 无法回传父组件的问题。将支付宝生命周期、props 更新和函数事件回调接入现有组件运行时，保持卸载清理与重新挂载的实例隔离。
