# weapp-vite-wevu-tailwindcss-tdesign-retail-template

基于 `tdesign-miniprogram-starter-retail` 页面结构重构的 wevu 模板：

- wevu + Vue SFC
- weapp-tailwindcss
- tdesign-miniprogram
- mokup 风格的文件路由 Mock（`src/mokup/routes/**/*.get.ts`）

## 开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
```

## Mock 约定

每个页面都有同路径 mock 文件，例如：

- 页面：`src/pages/order/order-list/index.vue`
- Mock：`src/mokup/routes/pages/order/order-list/index.get.ts`
