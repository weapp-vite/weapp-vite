---
'wevu': patch
'create-weapp-vite': patch
---

修复嵌套默认插槽中的自定义组件接收函数类型 Prop 时，函数在微信原生数据同步中丢失的问题，确保直接和嵌套使用方式保持一致。
