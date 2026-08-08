# uview-plus 兼容矩阵

该应用固定使用 `uview-plus@3.8.86`，以 npm 发布包的 `components/u-*/*.vue` 为事实来源。生成器会把 137 个 resolver 源码入口与组件目录互相校验，并为 135 个具名组件生成独立页面。

仓库通过 pnpm patch 修复该版本 `u-slider` 在设置 `height` 时引用未定义变量 `val` 的缺陷。兼容基线因此是 `uview-plus@3.8.86` 加 `patches/uview-plus@3.8.86.patch`；升级依赖时需要重新核对补丁是否仍然必要。

- `u-action-sheet-data` 没有组件名，由 `up-action-sheet` 场景覆盖。
- `u-column-notice` 没有组件名，由 `up-notice-bar` 场景覆盖。
- Web 移动端、Web 桌面端、微信开发者工具和 headless 都逐页执行 135 个场景，不使用 skip。
- Web 提交移动端与桌面端视觉基线；微信开发者工具提交独立视觉基线。
- 上传、图片、视频、时钟等场景只使用本地固定资源和确定性状态。

```bash
pnpm check:components
pnpm lint
pnpm stylelint
pnpm typecheck
pnpm build
pnpm build:web
```

`pnpm generate:components` 负责刷新页面、场景表、索引和 `project.private.config.json`；CI 使用 `check:components` 阻止生成结果漂移。
