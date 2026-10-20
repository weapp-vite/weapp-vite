---
"wevu": patch
"@weapp-vite/volar": patch
"create-weapp-vite": patch
---

fix(types): 将小程序原生模板 ref 的元素映射改为模块局部类型，修复 `map` 与浏览器 DOM 类型冲突。Volar 在 wevu 服务脚本中保留原生 ref、组件 expose 和浏览器及 SVG 元素的精确推导，避免向消费者全局 DOM 声明注入小程序标签。
