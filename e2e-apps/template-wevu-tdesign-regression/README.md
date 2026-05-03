# template-wevu-tdesign-regression

从 `templates/weapp-vite-wevu-tailwindcss-tdesign-template` 迁出的复杂页面回归用例。

## 页面结构

- TabBar：`首页` / `数据` / `表单` / `清单` / `能力`
- 子包：`组件实验室`（subpackages/lab）与 `API 场景`（subpackages/ability）
- 这里保留 layout feedback、表单、class/style 绑定、分包与 TDesign 集成覆盖；脚手架模板只保留最小首页。

## 使用方式

### 开发

- `pnpm dev`

- `pnpm dev --open` 可以打包并直接启动微信开发者工具

### 推荐写法

- 页面/组件优先使用 Vue `<script setup>`（编译宏）写法
- 配置使用 `<json>` 自定义块

### 构建

`pnpm build`

### 打开微信开发者工具

`pnpm open`

## 文档地址

0. `weapp-vite`: https://vite.icebreaker.top/
1. `wevu`: https://vite.icebreaker.top/wevu/
