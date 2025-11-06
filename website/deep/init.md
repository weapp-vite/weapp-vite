# `weapp-vite init` 做了什么？

`weapp-vite init` 是在现有原生项目上接入 weapp-vite 的最快方式。它会检查当前目录结构、补齐必需的配置文件，然后提示你后续可以手动调整的地方。本节逐步拆解各项改动，方便团队在需要时自行定制或纯手动迁移。

> [!TIP]
> 如果你更倾向于完全手工搭建，也可以把下面每一小节视为 Checklist，按需执行对应步骤。

## 1. 修改 `project.config.json`

- 设置 `miniprogramRoot` 指向 weapp-vite 产物目录（默认 `dist`），确保微信开发者工具预览/上传的始终是编译后的文件。
- 统一 `npm` 构建相关字段，避免与 weapp-vite 的自动 npm 策略冲突。

> 手工迁移时，记得在开发者工具中重新选择项目根目录或刷新配置，使其指向新的 `dist` 路径。

## 2. 更新 `package.json`

- 添加 `pnpm dev`、`pnpm build`、`pnpm open` 等脚本，与 weapp-vite CLI 对齐。
- 安装基础依赖（`weapp-vite`、`typescript`、`@types` 系列）以及推荐的工具链。

脚本示例：

```json
{
  "scripts": {
    "dev": "weapp-vite dev",
    "build": "weapp-vite build",
    "open": "weapp-vite open",
    "lint": "eslint . --ext .ts,.js --fix"
  }
}
```

## 3. 新增 `tsconfig.json` 与 `vite-env.d.ts`

- `tsconfig.json` 提供 TypeScript 编译基础配置，并启用小程序类型提示。
- `vite-env.d.ts` 声明 weapp-vite 自动注入的全局类型，避免在编辑器中出现缺失提示。

如果项目暂不使用 TypeScript，也建议保留这些文件，以便后续随时开启类型支持。

## 4. 生成 `vite.config.[m]ts`

- 创建标准的 `vite.config.ts`（或 `vite.config.mts`）并写入 weapp-vite 默认配置。
- 默认配置中包含 `weapp: { srcRoot: '.', subPackages: [] }` 等常用字段，你可以在此基础上继续补充别名、插件等设置。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: '.',
  },
})
```

> [!IMPORTANT]
> 若项目目录结构特殊（例如 `app.json` 位于 `miniprogram/`），请记得修改 `srcRoot`，并结合 [基础目录与资源收集配置](/config/paths.md) 进行调优。

## 5. 更新 `.gitignore`

- 添加 `dist/`、`node_modules/`、临时缓存等条目，避免编译产物误入版本库。
- 如果项目已有 `.gitignore`，脚手架会合并新条目而非覆盖原内容。

## 6. 其他辅助文件

- 视情况添加 `README` 提示、`pnpm-workspace.yaml`（在 Monorepo 场景下）等文件。
- 对于 SCSS/Tailwind 等需要额外配置的工具，脚手架会保留注释提示下一步应该如何开启。

---

完成 `weapp-vite init` 后，建议依次执行：

1. `pnpm install` 安装依赖；
2. `pnpm dev --open` 验证项目能在微信开发者工具中正常运行；
3. 参考 [快速开始](/guide/) 继续进行页面开发或自定义配置。

如需还原或自定义初始化流程，可直接查看脚手架源码：[`@weapp-core/init`](https://github.com/weapp-vite/weapp-vite/tree/main/packages/init)。
