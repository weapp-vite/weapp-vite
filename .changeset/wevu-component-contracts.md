---
'@weapp-core/constants': patch
'@weapp-vite/web': patch
'@wevu/compiler': minor
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': minor
---

feat(wevu): 完善 Wevu 首次绑定、原生插槽上下文和热更新响应式契约，并补充可选 setData 阶段观察能力。

- 微信目标在 `scopedSlotsRequireProps: true` 且 attached setup 时，普通原生插槽可同步注入最近 Wevu 承载者上下文，保留对象、响应式状态、方法身份与多实例隔离；不增加包装节点或改变原生 export。
- 原生声明关系独立于插槽是否可见，支持初始关闭、具名/转发/嵌套插槽及有效唯一原生 key 的循环重排、隐藏创建和卸载重建；最近内部父链不受 export/expose 过滤影响，Options API 别名仍保留组件身份。
- 默认增强模式下，普通节点包裹的 Wevu 子组件在嵌套插槽中同样保留最近普通模板父组件，避免错误继承外层 Provider；此项父链修复不局限于上述原生插槽增强选项。
- 保留模板表达式、循环和解构别名的声明作用域及无法投影 key 的降级诊断。created setup、其他宿主和未参与编译组件保持明确支持边界；非微信产物裁剪未启用的原生声明协议，Web 沿用既有插槽语义。
