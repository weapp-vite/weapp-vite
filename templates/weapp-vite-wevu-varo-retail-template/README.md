# Wevu + Varo 零售模板

这是一个面向微信小程序的本地零售示例，包含商品浏览、商品详情、购物车、模拟下单，
以及本地“我的”、我的订单和收货地址。

```sh
pnpm install
pnpm dev
```

## Varo shadcn 模式

`src/components/ui`、`src/lib` 与 `src/styles/varo*.css` 来自
`@varo-ui/cli@3.0.0` 的 `weapp` Registry。源码已经复制进项目，可以直接修改。
新增组件时执行：

```sh
pnpm dlx @varo-ui/cli@3.0.0 add --target weapp <component>
```

添加组件后，安装 CLI 输出且项目尚未包含的依赖，再重启开发服务。全局样式由
`weapp-vite.config.ts` 自动收集，`varo.css` 始终最先加载。

## 示例边界

- 商品、地址、购物车和订单保存在本地。
- “提交模拟订单”不会发起支付或网络请求。
- 生产项目需要自行接入后端、鉴权、支付、库存、物流和退款。
- 商品照片是模板自带的演示素材，可以替换为项目自己的图片。

Varo Registry 源码遵循其 MIT License，来源和固定版本见 [VARO_REGISTRY.md](./VARO_REGISTRY.md)。
