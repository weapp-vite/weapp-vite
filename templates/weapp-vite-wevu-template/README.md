# weapp-vite-wevu-template

`weapp-vite` + `wevu`（Vue SFC）最小模板。

## 使用方式

### 开发

- `pnpm dev`

- `pnpm dev --open` 可以打包并直接启动微信开发者工具

### 推荐写法

- 页面/组件优先使用 Vue `<script setup>`（编译宏）写法
- 配置使用 `<json>` 自定义块
- `app.json` 里的 `pages` 通过 `weapp-vite/auto-routes` 自动生成
- layout、分包、router 等验证性示例在 `e2e-apps/template-wevu-regression`

### 构建

`pnpm build`

### 打开微信开发者工具

`pnpm open`

## 文档地址

0. `weapp-vite`: https://vite.icebreaker.top/
1. `wevu`: https://vite.icebreaker.top/wevu/
