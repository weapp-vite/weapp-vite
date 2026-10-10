---
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

fix(wevu): 修复首次绑定、同名 prop 与 setup 状态、HMR 响应式重绑定及外部脚本依赖。

- setup 局部状态与 prop 同名时使用独立模板计算字段，父级属性与局部状态分别更新；覆盖导入/展开 props、循环和插槽作用域。
- 补齐首次样式、类名占位值，保留显式 data 与 setData 过滤。React 原生桥等待首次绑定快照再挂载，使动态属性与 setup 读取正确初值，后续更新保留实例和本地状态。
- classic/stateful 刷新后重新绑定 CSS 变量等 setup 响应式依赖；生产构建裁剪 HMR 实例刷新和初始调试快照代码，开发及未定义构建环境的消费者保持原行为。
- 外部 script setup 仅有导入或尾部空白时生成有效脚本，页面和组件共享源码位置及 sourcemap；显式追踪外部脚本/模板依赖并保留样式局部刷新，签名缓存随 Vue 解析结果释放。
