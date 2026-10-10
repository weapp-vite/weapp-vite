---
'@weapp-core/constants': patch
'@weapp-vite/web': patch
'@wevu/compiler': minor
'create-weapp-vite': patch
'weapp-vite': minor
'wevu': minor
---

完善 Wevu 首次绑定、原生插槽上下文和热更新响应式契约，并补充可选 setData 阶段观察能力。

- 微信目标在 `scopedSlotsRequireProps: true` 且 attached setup 时，普通原生插槽可同步注入最近 Wevu 承载者上下文，保留对象、响应式状态、方法身份与多实例隔离；不增加包装节点或改变原生 export。
- 原生声明关系独立于插槽是否可见，支持初始关闭、具名/转发/嵌套插槽及有效唯一原生 key 的循环重排、隐藏创建和卸载重建；最近内部父链不受 export/expose 过滤影响，Options API 别名仍保留组件身份。
- 默认增强模式下，普通节点包裹的 Wevu 子组件在嵌套插槽中同样保留最近普通模板父组件，避免错误继承外层 Provider；此项父链修复不局限于上述原生插槽增强选项。
- 保留模板表达式、循环和解构别名的声明作用域及无法投影 key 的降级诊断。created setup、其他宿主和未参与编译组件保持明确支持边界；非微信产物裁剪未启用的原生声明协议，Web 沿用既有插槽语义。
- setup 局部状态与 prop 同名时使用独立模板计算字段，父级属性与局部状态分别更新；覆盖导入/展开 props、循环和插槽作用域。
- 补齐首次样式、类名占位值，保留显式 data 与 setData 过滤。React 原生桥等待首次绑定快照再挂载，使动态属性与 setup 读取正确初值，后续更新保留实例和本地状态。
- classic/stateful 刷新后重新绑定 CSS 变量等 setup 响应式依赖；生产构建裁剪 HMR 实例刷新和初始调试快照代码，开发及未定义构建环境的消费者保持原行为。
- 外部 script setup 仅有导入或尾部空白时生成有效脚本，页面和组件共享源码位置及 sourcemap；显式追踪外部脚本/模板依赖并保留样式局部刷新，签名缓存随 Vue 解析结果释放。
- JSON 自定义合并回调可读取静态路由声明及完整页面元信息，覆盖编译、产物合并和 JSON-only HMR。
- setData 调试回调可选记录 prepare、物理 dispatch、commit、revision、合并调用、UTF-8 字节和失败恢复。默认关闭，保留 nextTick 与提交屏障语义，明确 callback、Promise、同步返回和可见视图的证据边界。
