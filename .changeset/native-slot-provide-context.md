---
"wevu": minor
"@wevu/compiler": minor
"@weapp-core/constants": patch
"weapp-vite": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

微信目标在 `scopedSlotsRequireProps: true` 且使用 attached setup 时，普通原生插槽内容可同步注入最近 Wevu 承载者的上下文，保留对象、响应式状态与方法身份，以及多实例隔离和卸载重建行为；无需作用域参数、额外包装节点或修改原生 export。明确 created setup、其他宿主及未参与编译组件的支持边界，Web 继续沿用原有插槽行为。

原生插槽与普通模板子组件组合时，即使内层 Wevu Provider 过滤了 export/expose，仍按最近的内部父链注入上下文，不暴露私有实例或误选外层 Provider；Options API 局部注册别名同样保留 Wevu 组件身份。

同时修复默认增强模式下，被普通节点包裹的已知 Wevu 子组件在嵌套插槽中错误继承外层 Provider 的问题；保持模板表达式的声明作用域，并保留更近的普通模板父组件。

非微信目标在构建期裁剪微信原生插槽父级发现分支，避免未启用协议仍增加最小应用体积。自定义 glass-easel 预览宿主的初始未投影条件插槽场景仍有已知注入失败，尚未完成该宿主兼容验收。
