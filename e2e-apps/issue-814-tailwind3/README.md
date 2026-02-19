# issue-814-tailwind3

用于对照 [weapp-tailwindcss#814](https://github.com/sonofmagic/weapp-tailwindcss/issues/814) 的 TailwindCSS 3 场景。

## 运行

```bash
pnpm install --filter ./e2e-apps/issue-814-tailwind3
cd e2e-apps/issue-814-tailwind3
node ../../packages/weapp-vite/bin/weapp-vite.js build . --platform weapp --skipNpm
```

## 关键检查点

- `dist/pages/index/index.wxml` 中静态 class 会被转义为 `gap-_b20px_B`
- `dist/pages/index/index.js` 中动态 `:class` 也会被转义为 `gap-_b20px_B`

该案例用于提供 TailwindCSS 3 的对照基线。
