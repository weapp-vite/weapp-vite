---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复静态 React 原生组件桥接在首次绑定快照送达前提前挂载的问题，确保动态属性从正确初值初始化，避免数字属性告警和组件 setup 读取到临时默认值。后续属性更新保留组件实例及本地状态。
