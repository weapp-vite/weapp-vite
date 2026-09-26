# issue-814-tailwind4

用于验证 [weapp-tailwindcss#814](https://github.com/sonofmagic/weapp-tailwindcss/issues/814) 的 Vue 动态 class 场景，使用 Tailwind CSS 4 与 weapp-vite 内置 Tailwind Core 集成，无需运行 patch 命令。配置统一位于 `vite.config.ts`。

## 运行

```bash
pnpm install --filter ./e2e-apps/issue-814-tailwind4
cd e2e-apps/issue-814-tailwind4
node ../../packages/weapp-vite/bin/weapp-vite.js build . --platform weapp --skipNpm
```

## 关键检查点

- WXML 中静态 `gap-[24px]` 转义为 `gap-_b24px_B`，动态节点保留数据绑定。
- 输出 JavaScript 中的动态 `gap-[17px]` 转义为 `gap-_b17px_B`。
- `app.wxss` 生成两个匹配的选择器，以及 `gap: 24px`、`gap: 17px`，证明真实候选进入 Core 编译。

CI 回归入口为 `e2e/ci/issue-814-tailwind-dynamic-class.e2e.test.ts`；构建断言不替代真实 IDE 的 DOM 验收。
