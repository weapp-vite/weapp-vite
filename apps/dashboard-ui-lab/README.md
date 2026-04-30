# dashboard-ui-lab

`dashboard-ui-lab` 是专门用于本地验证 `@weapp-vite/dashboard` 的小程序项目。

它不是业务示例，也不进入 E2E 串行套件；目标是在开发 dashboard 或 CLI UI 链路时，用一条命令打开带真实 analyze payload 的 UI。

## 覆盖点

- 主包页面、普通分包、独立分包。
- 多页面、多样式文件、组件和静态资源。
- WeVu / Vue SFC 页面与组件，用于观察 dashboard 对 Vue runtime chunk、SFC 页面和 SFC 组件的分析结果。
- 跨包复用的 `src/shared/*` 模块，用于观察 duplicate module 与 module source 面板。
- `dev:ui` 实时模式，用于验证 dashboard 首页、分析页、活动流、设计 token 和主题切换。

## 常用命令

```bash
pnpm --filter dashboard-ui-lab dev:ui
```

```bash
pnpm --filter dashboard-ui-lab build:ui
```

```bash
pnpm --filter dashboard-ui-lab build
```

本仓库开发态下，`wv dev --ui` 会优先读取 `@weapp-vite/dashboard` 的源码入口；发布包安装场景则继续读取 dashboard 的 `dist/` 静态产物。
