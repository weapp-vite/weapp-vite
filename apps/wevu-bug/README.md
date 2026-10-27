# weapp-vite-wevu-template

`weapp-vite` + `wevu`（Vue SFC）模板

## 使用方式

### 开发

- `pnpm dev`

- `pnpm dev --open` 可以打包并直接启动微信开发者工具

### 推荐写法

- 页面/组件优先使用 Vue `<script setup>`（编译宏）写法
- 配置使用 `<json>` 自定义块

### 构建

`pnpm build`

### 类型检查

`pnpm typecheck` 检查正常页面，通过 `tsconfig.typecheck.json` 仅排除故意演示类型错误的 `src/pages/typecheck-errors/index.vue`。

`pnpm test` 使用已构建的 `weapp-vite` CLI 执行 `prepare`，再检查完整的受管应用配置，要求该页面保留四处预期诊断且没有其他类型错误。根 `tsconfig.json` 和页面源码保持完整，IDE 中仍可查看这些错误。

### 打开微信开发者工具

`pnpm open`

## 文档地址

0. `weapp-vite`: https://vite.weapp.dev/
1. `wevu`: https://vite.weapp.dev/wevu/
