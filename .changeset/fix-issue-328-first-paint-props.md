---
'wevu': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
---

修复 issue #328 中 `<script setup>` 首帧数据与子组件 prop 同步过晚的问题：编译产物现在会为可静态推导的 setup 初始值注入首帧 `data`，运行时注册阶段也会把这些初始数据同步保留到原生组件/页面定义中，避免父级 `ref('111')` 在首屏绑定到子组件 `String` prop 时先落成 `null` 并触发小程序类型 warning。同时补充 `github-issues` 的 issue-328 构建与 IDE 端到端回归用例，以及相关运行时/编译单测。
