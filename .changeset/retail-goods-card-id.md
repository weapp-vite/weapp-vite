---
"weapp-vite-wevu-tailwindcss-tdesign-retail-template": patch
"create-weapp-vite": patch
---

将零售模板购物车、订单商品卡片和规格卡片的自定义标识属性统一为 `cardId`，避免小程序宿主保留属性 `id` 无法作为组件参数传入，恢复自定义节点标识及其动态更新，并保留未传值时的自动标识和商品数据中的 `id`。
