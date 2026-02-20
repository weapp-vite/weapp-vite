# weapp-vite-wevu-tailwindcss-tdesign-retail-template

该模板页面、组件与交互逻辑已与 `apps/tdesign-miniprogram-starter-retail` 保持一致。

- 页面与业务组件统一采用 Vue SFC（`.vue`）编写
- 业务脚本统一采用 TypeScript（`lang="ts"` / `*.ts`）
- 不再使用微信原生四文件（`*.js` + `*.wxml` + `*.wxss` + `*.json`）作为页面/组件源码

## 开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
```

## 页面对齐说明

- 页面路径与 `app.json` 分包配置一一对应
- 页面结构、组件引用、事件处理与原项目同步
- 不包含 `RetailPageShell`/`mokup` 占位页实现
