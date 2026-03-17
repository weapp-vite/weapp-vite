# @weapp-vite/dashboard

## 6.10.1

## 6.10.0

### Minor Changes

- ✨ **将 `weapp-vite analyze` 的仪表盘资源从主包中拆分为独立的可选安装包 `@weapp-vite/dashboard`。未安装该包时，CLI 会提示对应的安装命令并自动降级为仅输出分析结果，不再要求主包默认携带大体积 dashboard 静态资源。** [`be412dd`](https://github.com/weapp-vite/weapp-vite/commit/be412dda3507e7c29cb25be0e90d5e5374f18fde) by @sonofmagic
