# Weapp Agent 整合迁移

来源：weappjs/weapp-agent，提交 `a8a37d4a82c83c2701e36c09b2224462ec8d5514`。采用源码快照；原仓库保留 Git 历史。

`inventory.json` 列出全部来源文件及迁移/替代去向。模型 CLI 保持兼容；验收实现抽至 `@weapp-vite/acceptance`，运行操作复用现有 DevTools 会话。

`source/` 保留来源许可证、说明及历史验证记录；历史记录不代表本次迁移已经验收通过。新增验证记录单独维护。文档正文迁入现有网站，不迁入第二套 Astro 主题与部署。

## 工程边界

发布入口位于 `packages/agent-cli`，纳入现有 packages 发布构建。模型循环及适配器仍为私有包，随独立 CLI 打包；验收包只打包 core 的无模型公共入口。运行适配器位于现有 MCP/DevTools 层，验收不反向依赖它们。

超过 300 行的迁移模块已评估：本次优先保留模型循环、CLI 命令和报告状态机的既有行为，验收、配置入口、场景和运行适配器已按边界拆分；继续拆分状态机将扩大兼容风险，留待独立重构。全部来源文件的处置见 inventory.json；当前验证见 [validation.md](./validation.md)。
