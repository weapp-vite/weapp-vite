# 更新日志

## 0.0.5

### Patch Changes

- 🐛 **收紧 VS Code 扩展对 weapp-vite 项目的识别条件，不再把 `create-weapp-vite` 依赖当作正式项目识别信号，避免把脚手架包误判为业务项目依赖。** [`2592666`](https://github.com/weapp-vite/weapp-vite/commit/2592666e52fe2f115dbab09855e8c39e87e5f6b3) by @sonofmagic

- 🐛 **将 VS Code 扩展发布流程合并到仓库统一的 changeset release 流程中：扩展版本由 changeset 驱动更新，合并 release PR 后自动发布到 VS Code Marketplace，但不会发布到 npm。** [`e025c8a`](https://github.com/weapp-vite/weapp-vite/commit/e025c8adcdbd5056fa31c38c05648b957b243f12) by @sonofmagic

- 🐛 **优化 VS Code 插件在 Marketplace 详情页中的展示信息：补充中文简介、官方入口链接与更完整的功能说明，方便用户在安装前快速了解扩展用途与文档入口。** [`3a64b6e`](https://github.com/weapp-vite/weapp-vite/commit/3a64b6e8452a55eb74c3973d0bb1fc444b9a146b) by @sonofmagic

## Unreleased

- 收紧项目识别条件，不再把 `create-weapp-vite` 依赖视为 weapp-vite 项目信号。
- 优化 VS Code Marketplace 详情页信息，补充中文简介、官方入口与更完整的扩展说明。
- 新增工作区识别、状态栏入口、输出面板和统一动作选择器。
- 新增 `dev`、`build`、`generate`、`open`、`doctor/info` 等实用命令。
- 新增 `<json>` 自定义块和 `defineConfig` 代码片段。
- 新增编辑器代码操作、Vue `<json>` 自定义块补全，以及 `package.json` 脚本诊断。
- 新增面向 `package.json`、`vite.config` 和 Vue 自定义块的轻量悬浮提示、上下文补全和文档快捷入口。
- 新增状态栏、诊断、悬浮、补全和 CLI 别名偏好的扩展配置项。
- 新增针对脚本建议与命令解析行为的纯逻辑测试。
- 新增 manifest 校验测试、面向发布的打包文件清单、命令面板可见性规则，以及首次使用说明。
- 从 VSIX 打包中排除测试文件，并新增发布前打包检查。
- 新增用于本地 CI 与发版门禁的独立包校验脚本。
- 新增扩展专用的 GitHub Actions CI 工作流。
- 新增可在本地和 CI 复用的 VSIX dry-run 打包脚本。
- 新增面向 VS Code Marketplace 的手动发布工作流和发布脚本。
- 将扩展运行时、单元测试和包脚本迁移到 TypeScript，并使用编译后的 `dist/` 作为入口。
- 将扩展运行时构建从 `tsc` 输出切换为 `tsdown` 打包，同时保持 TypeScript 测试流程不变。
- 新增编译产物 smoke test，以及独立的 VSIX 归档校验脚本，以提升打包安全性。

## 0.0.1

- 初始版本：默认将 `.vue` 中的 `<json>` 自定义块按 JSONC 高亮。
