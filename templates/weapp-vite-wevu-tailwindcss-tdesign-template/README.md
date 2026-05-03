# weapp-vite-wevu-template

`weapp-vite` + `wevu` + `TDesign` + `Tailwind CSS` 最小模板。

## 使用方式

### 开发

- `pnpm dev`

- `pnpm dev --open` 可以打包并直接启动微信开发者工具

### 推荐写法

- 页面/组件优先使用 Vue `<script setup>`（编译宏）写法
- 配置使用 `<json>` 自定义块
- TDesign 组件通过 `TDesignResolver()` 自动导入
- 复杂页面、layout feedback、class/style 绑定等验证性示例在 `e2e-apps/template-wevu-tdesign-regression`

### 构建

`pnpm build`

### 打开微信开发者工具

`pnpm open`

## 文档地址

0. `weapp-vite`: https://vite.icebreaker.top/
1. `wevu`: https://vite.icebreaker.top/wevu/
