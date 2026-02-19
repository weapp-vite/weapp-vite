# issue-814-tailwind4-broken

用于在 TailwindCSS 4.2.0 下稳定模拟 [weapp-tailwindcss#814](https://github.com/sonofmagic/weapp-tailwindcss/issues/814) 的失败症状。

## 运行

```bash
pnpm install --filter ./e2e-apps/issue-814-tailwind4-broken
cd e2e-apps/issue-814-tailwind4-broken
node ../../packages/weapp-vite/bin/weapp-vite.js build . --platform weapp --skipNpm
```

## 关键检查点

- `dist/pages/index/index.wxml` 中静态 class 被转义为 `gap-_b20px_B`
- `dist/pages/index/index.js` 中动态 `:class` 保留 `gap-[20px]`

该案例通过 `vite.config.ts` 中的 `jsPreserveClass` 故意保留 JS 里的方括号类名，用于回归测试故障态。
