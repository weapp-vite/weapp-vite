# weapp-vite-wevu-tailwindcss-tdesign-retail-template

该模板页面、组件与交互逻辑已与 `apps/tdesign-miniprogram-starter-retail` 保持一致。

- 页面与业务组件统一采用 Vue SFC（`.vue`）编写
- 业务脚本统一采用 TypeScript（`lang="ts"` / `*.ts`）
- 不再使用微信原生四文件（`*.js` + `*.wxml` + `*.wxss` + `*.json`）作为页面/组件源码

## 模板能力

- 首页、分类、购物车、个人中心四大 Tab
- 商品列表 / 搜索 / 详情 / 评论 / 评价
- 订单确认 / 订单列表 / 订单详情 / 物流 / 发票 / 售后
- 优惠券与营销活动页
- 地址管理、个人资料、昵称修改
- Tailwind + TDesign 组件体系
- Mock 数据开箱可跑，适合二开落地

## 开发与构建

```bash
pnpm install
pnpm dev
pnpm build
```

## 快速验证

```bash
# 模板自身构建
pnpm -C templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template build

# 与源应用做结构 parity e2e（在仓库根目录执行）
pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts
```

## 二开定制建议

- 修改业务接口：`src/services/**`
- 切换 mock/真实接口：`src/config/index.ts`
- 调整页面路由与分包：`src/app.vue` 内 `defineAppJson`
- 调整主题与样式：`tailwind.config.ts` + 组件内 Tailwind utilities
- 调整常用启动场景：`project.config.json` 与 `project.private.config.json` 中 `condition.miniprogram.list`

## 对齐原则

- 页面路径与 `app.json` 分包配置一一对应
- 页面结构、组件引用、事件处理与原项目同步
- 不包含 `RetailPageShell`/`mokup` 占位页实现
