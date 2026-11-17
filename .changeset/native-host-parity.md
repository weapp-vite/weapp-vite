---
"@weapp-core/shared": patch
"@mpcore/simulator": patch
"@weapp-vite/miniprogram-automator": patch
---

fix(simulator): 对齐原生布尔属性、表单字段与富文本的宿主语义。

保留布尔绑定的原始值，区分空值和裸属性；禁用按钮不派发点击或表单默认动作，重渲染后的保留句柄按当前节点身份处理。原生表单收集参与组件的当前 name/value，保持私有字段隔离。

原生 rich-text 使用显式的受信任节点和属性策略，移除不支持的整个子树，文本实体仅解码一次，不解释内嵌 WXML；共享工具默认的 Web 规范化行为不变。Web 与原生策略使用独立导出，避免 Web runtime 保留原生校验和额外实体解码代码。

浏览器预览在中键按下阶段阻止原生富文本链接和表单按钮的宿主默认动作，避免 Windows 自动滚动等行为先于 auxclick 生效；保留主键点击、外层 tap 和非受保护内容的原有行为。
