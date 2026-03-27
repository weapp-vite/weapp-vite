# @weapp-vite/dashboard

## 6.11.7

## 6.11.6

### Patch Changes

- 🐛 **为 `weapp-vite` 新增 `--ui` 调试入口并保留 `--analyze` 兼容别名，同时将 dashboard 升级为单页多面板分析 UI，集中展示包体、分包、产物文件与跨包模块复用细节。** [`f278c9f`](https://github.com/weapp-vite/weapp-vite/commit/f278c9f04bb4b17138cbb3bb21f2f969585d08d3) by @sonofmagic

## 6.11.5

## 6.11.4

## 6.11.3

## 6.11.2

## 6.11.1

## 6.11.0

## 6.10.2

## 6.10.1

## 6.10.0

### Minor Changes

- ✨ **将 `weapp-vite analyze` 的仪表盘资源从主包中拆分为独立的可选安装包 `@weapp-vite/dashboard`。未安装该包时，CLI 会提示对应的安装命令并自动降级为仅输出分析结果，不再要求主包默认携带大体积 dashboard 静态资源。** [`be412dd`](https://github.com/weapp-vite/weapp-vite/commit/be412dda3507e7c29cb25be0e90d5e5374f18fde) by @sonofmagic
