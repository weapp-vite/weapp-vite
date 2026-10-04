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

非微信目标在构建期裁剪微信原生插槽父级发现分支，避免未启用协议仍增加最小应用体积。原生声明关系独立于插槽是否投影，通过模板所有者的实例索引同步关联初始关闭的条件插槽，不需要提前打开 Dialog 或延迟 setup；循环声明跟随有效且唯一的原生 key，保留重排、隐藏时创建及卸载重建的实例边界。

模板 props 别名改写遵守循环局部作用域，避免同名解构别名覆盖原生声明身份，并保留无法投影原生 key 时的降级诊断。
