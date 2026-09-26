# issue-814-tailwind4-broken

用于给 [weapp-tailwindcss#814](https://github.com/sonofmagic/weapp-tailwindcss/issues/814) 回归提供负向对照。使用 Tailwind CSS 4 与 weapp-vite 内置 Tailwind Core，通过公开 `jsPreserveClass` 选项主动保留 JavaScript 中的任意值类名，不依赖旧版缺陷或 patch 命令。

## 运行

```bash
pnpm install --filter ./e2e-apps/issue-814-tailwind4-broken
cd e2e-apps/issue-814-tailwind4-broken
node ../../packages/weapp-vite/bin/weapp-vite.js build . --platform weapp --skipNpm
```

## 关键检查点

- WXML 中静态 `gap-[24px]` 仍转义为 `gap-_b24px_B`，动态节点保留数据绑定。
- 输出 JavaScript 中动态类保留 `gap-[17px]`，没有匹配的 `gap-_b17px_B`。
- `app.wxss` 仍生成 `.gap-_b17px_B` 与 `gap: 17px`，明确展示主动保留 JavaScript 类名后产生的选择器不匹配。

配置统一位于 `vite.config.ts`。CI 回归入口为 `e2e/ci/issue-814-tailwind-dynamic-class.e2e.test.ts`；此负向对照通过不表示其业务界面正确。
