# tdesign retail 模板对齐与 Tailwind 迁移报告（2026-02-20）

## 范围

本次针对 `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template` 执行以下约束落地：

1. 页面与组件源码统一为 Vue SFC + TypeScript。
2. 不保留页面/组件的微信原生四文件源码（`*.wxml/*.wxss/*.json/*.js`）。
3. 集成 `weapp-tailwindcss`，并将样式迁移到 Tailwind 原子类（含 arbitrary utility / arbitrary variant）。
4. 通过 E2E 对比 `apps/tdesign-miniprogram-starter-retail` 与模板项目的 WXML DOM 结构。

## 结构与配置结果

### 1) SFC + TS 形态

- `src/app.vue` 使用 `defineAppJson` + `<script setup lang="ts">`。
- `src/pages/**`、`src/components/**`、`src/custom-tab-bar/**` 为 `.vue` + `.ts` 形态。
- 检查结果：上述目录下页面/组件源码 `*.wxml/*.wxss/*.json/*.js` 数量为 `0`。

### 2) Tailwind 集成

- `vite.config.ts` 已启用 `UnifiedViteWeappTailwindcssPlugin({ rem2rpx: true })`。
- `tailwind.config.ts`、`postcss.config.js` 已配置。
- `src/app.vue` 仅保留 Tailwind 指令样式块：
  - `@tailwind base;`
  - `@tailwind components;`
  - `@tailwind utilities;`
- 已删除 `src/style/*.wxss` 的未引用遗留样式文件，避免回退到原生样式链路。

## 样式迁移统计（自动补迁移后二次结果）

数据来源：`docs/reports/2026-02-20-retail-tailwind-migration-automation.json`

- `totalRules`: 1203
- `convertedRules`: 1098
- `convertedRate`: 91.27%
- `unresolvedRuleCount`: 105
- `fileChanged`: 65
- `injectedClassCount`: 3708

未迁移规则主因分布：

1. `pseudo-element`：39
2. `no-class-selector`：31（例如 `page`、`:host`）
3. `no-declaration`：22（空规则）
4. `unsupported-pseudo`：8（如 `:not(...)`）
5. `unsupported-combinator`：5（如 `>` 组合器）

说明：本次补迁移优先将“后代 class 选择器”转为 Tailwind arbitrary variant，避免恢复 wxss 样式块。

## 验证结果

### 1) 构建

命令：

```bash
pnpm --filter weapp-vite-wevu-tailwindcss-tdesign-retail-template build
```

结果：通过。

### 2) 类型检查

命令：

```bash
cd templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template
pnpm typecheck
```

结果：未通过，当前 `error TS` 约 `1173` 条（属于现有大量 TS 类型问题，不仅限于 Tailwind 迁移）。

### 3) 双端 E2E DOM 对齐（两边同时启动微信开发者工具）

命令：

```bash
pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts
```

执行情况：

- 第一次失败：`Port 9420 is in use`（端口占用）。
- 清理占用后再次执行：失败，错误为
  `Failed to launch wechat web devTools, please make sure http port is open`。

结论：当前环境未满足微信开发者工具自动化连接前置条件（服务端口未开启/不可用），因此本次未能产出最新的双端 DOM 相似度结果。

## 当前结论

1. 模板源码形态已满足“Vue SFC + TypeScript，且无页面/组件原生四文件源码”。
2. `weapp-tailwindcss` 已完成集成，样式迁移达到 91.27% 的自动覆盖率。
3. 构建通过，但类型检查仍有大量历史/存量问题。
4. 双端 E2E 对齐流程已执行到自动化启动阶段，受微信开发者工具服务端口条件阻塞，需在本机开启后重跑。
