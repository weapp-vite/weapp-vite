---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-core/init": patch
---

为 `weapp-vite` 增加了由 `.weapp-vite/tsconfig.app.json`、`.weapp-vite/tsconfig.server.json`、`.weapp-vite/tsconfig.node.json` 与 `.weapp-vite/tsconfig.shared.json` 组成的托管 TypeScript 配置输出。`weapp-vite prepare` 现在会同步生成这些文件，CLI 在加载 `vite.config.ts` 之前也会先做一次轻量 bootstrap，避免根 `tsconfig.json` 仅保留 references 后出现配置加载失败。

同时，`create-weapp-vite` 模板与 `@weapp-core/init` 生成的根 `tsconfig.json` 现已统一收敛为 Nuxt 风格的轻量入口，只保留对 `.weapp-vite/*` 的 references；相关示例项目与模板的 `typecheck` 脚本也改为直接指向 `.weapp-vite/tsconfig.app.json`，从而将主要 TypeScript 配置的维护职责收拢到 `weapp-vite`。对于仍保留项目根目录 `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.server.json` / `tsconfig.shared.json` 的旧项目，`weapp-vite` 也会在生成 `.weapp-vite` 托管产物时自动合并这些手写配置，便于渐进迁移。模板中预置了 `tdesign-miniprogram` 与 `@vant/weapp` 等常见小程序 UI 库时，也会同步在托管的 app tsconfig 中带上对应 `paths` 别名，方便直接获取库内的 TypeScript/JavaScript 声明与实现入口。
