# template-wevu-regression

从 `templates/weapp-vite-wevu-template` 迁出的复杂页面回归用例。

## 使用方式

### 开发

- `pnpm dev`

- `pnpm dev --open` 可以打包并直接启动微信开发者工具

### 推荐写法

- 页面/组件优先使用 Vue `<script setup>`（编译宏）写法
- 配置使用 `<json>` 自定义块
- `src/components` 下的 Vue SFC（`*.vue`）与原生组件（`*.wxml`）默认开启自动导入，页面中可直接使用组件标签
- `app.json` 里的 `pages` 与 `subPackages` 通过 `weapp-vite/auto-routes` 自动生成，普通分包页面也会自动收集
- 这里保留 layout、分包、自动导入组件与 router 相关覆盖；脚手架模板只保留最小首页。

### 构建

`pnpm build`

### 打开微信开发者工具

`pnpm open`

## 文档地址

0. `weapp-vite`: https://vite.icebreaker.top/
1. `wevu`: https://vite.icebreaker.top/wevu/
