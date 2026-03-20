---
'create-weapp-vite': patch
'weapp-vite-wevu-tailwindcss-tdesign-retail-template': patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 在订单列表与订单详情页的运行时崩溃问题。模板中的订单卡片 relation 回调改为兼容 `children` 提前未初始化的时序，订单按钮栏也补充了 `order`、`goodsList`、`openType` 等空值保护，并去除了与组件属性同名的冗余 data 字段，减少了 DevTools 运行期告警。对应修复会同步影响 `create-weapp-vite` 生成的新零售模板项目。
