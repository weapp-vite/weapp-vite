---
'@mpcore/simulator': patch
'@weapp-core/constants': patch
'@weapp-vite/web': patch
'create-weapp-vite': patch
'wevu': patch
---

fix(web): 修复 Web 原生/Wevu 应用的样式、事件与宿主实例桥接，并保持对应 simulator 事件语义一致。

- Vue 与原生 App 入口共享应用样式状态，按页面/组件隔离选项处理主题继承和局部覆盖；支持外部与内联样式热更新、移除及重新添加而不重置页面状态。避免选择器权重漂移和样式拼接破坏合法 `@import`。
- 分离组件自定义事件与同名原生事件，避免一次点击重复回调；保留名称、载荷、冒泡、捕获和手势别名，legacy 模板保留节点时正确复用或替换监听器。
- 分离 props 输入和 setup 方法，保留同名 Boolean 属性；完整方法快照支持替换与移除，调用时读取最新 runtime 和原生 receiver，setup 方法优先于静态方法，普通实例显式赋值、访问器和不可配置属性保持原边界。
- 修复嵌套对象、数组和同引用整值提交后的深层输入投影；simulator Node/browser 共用声明树事件路径，保持普通祖先、组件边界、catch、源宿主目标及重渲染监听实例归属。
- canvas 仅在对应尺寸属性真正变化时调整位图，普通属性同步、重复尺寸或重新挂载不再清空绘图，保留绘图 API 直接设置的尺寸。
