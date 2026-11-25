## Varo 微信电商示例

- 商品、示例地址、购物车和订单使用本地演示数据。模拟订单标记为 `simulation`，接入真实业务时由应用服务负责登录、支付、库存与配送。
- `src/components/ui/` 的 Varo 组件来自微信 Registry，可在项目中修改。添加组件时参考 [Varo Registry 指南](https://varo.weapp.dev/guide/shadcn-mode)，安装 CLI 报告的依赖。
- 将 `src/styles/varo.css` 排在 Registry 样式第一位，并通过 `weapp.styles` 全局注册到 `app.vue`。组件沿用原生 `apply-shared` 样式隔离。
