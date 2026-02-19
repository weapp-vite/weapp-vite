# issue-814-tailwind4

用于对照 [weapp-tailwindcss#814](https://github.com/sonofmagic/weapp-tailwindcss/issues/814) 的 TailwindCSS 4.2.0 场景。

## 运行

```bash
pnpm install --filter ./e2e-apps/issue-814-tailwind4
cd e2e-apps/issue-814-tailwind4
node ../../packages/weapp-vite/bin/weapp-vite.js build . --platform weapp --skipNpm
```

## 关键检查点

- `dist/pages/index/index.wxml` 中静态 class 被转义为 `gap-_b20px_B`
- `dist/pages/index/index.js` 中动态 `:class` 也被转义为 `gap-_b20px_B`

说明当前仓库下该最小案例的 TailwindCSS 4 表现为动态 class 已转义。
