---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复合法 Vue void 标签导致自动组件登记中断的问题，保留原生模板依赖、脚本限制与外部模板路径定位；修复动态布局字符串默认值的属性转义，并补齐布局示例的首屏属性配置。
