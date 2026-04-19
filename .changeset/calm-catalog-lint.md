---
"create-weapp-vite": patch
---

将模板中的 `eslint`、`stylelint`、`@icebreakers/eslint-config` 与 `@icebreakers/stylelint-config` 统一收敛到 workspace catalog，并同步刷新 `create-weapp-vite` 的模板 catalog。这样后续通过脚手架创建的新项目会自动解析这几项依赖的当前 catalog 版本，减少模板目录与生成结果之间的版本漂移。
