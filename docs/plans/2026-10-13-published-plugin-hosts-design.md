# 发布包插件宿主依赖与严格消费者

严格 pnpm 消费者关闭自动 peer 安装和 peer 合并后，已有发布档案安装失败：core 的 Babel preset/CommonJS 插件和 MCP Node adapter 缺少宿主；compiler 的 Vue JSX 插件链也缺少 Babel。宿主位于兄弟依赖的子树中，不能为这些插件提供 peer。全部候选档案置顶的消费者同时缺少 wevu、rolldown-require 和 Tailwind reset 要求的用户 peer。

## 选择与范围

采用直接宿主归属：weapp-vite 声明 Babel core 与 MCP server，compiler 声明 Babel core。版本分别沿用当前 Babel catalog 和已有 MCP server 范围。应用继续负责公开包所要求的 typings、rolldown 和 Tailwind peer。

把插件和宿主整体移入 AST 包也能统一归属，但会扩大模块边界和导出改动。打开自动 peer 安装会补齐部分宿主，同时把可选 agentic 带入 core 的 devframe 图，无法覆盖原隔离场景。本次保留两个关闭开关和原物理身份断言。

不修改 wevu、rolldown-require 的公开 peer 契约，不固定生产 core 的 Tailwind 版本，不增加公开 API。普通 native 应用是否受到上游可选 Tailwind 包装边界影响，需要独立核验；给完整闭包消费者提供合法 Tailwind peer 不等于解决该问题。

## 消费者与回归

发布验证使用独立 tarball、消费者目录、node_modules、锁和 store。npm 与 pnpm 提供相同的三项用户 peer；版本来自候选仓库 catalog，正式矩阵另按实际输入固定版本。候选 overrides 只映射框架档案，不修改第三方 peer 声明或忽略缺失项。

pnpm 保留 strict、isolated、不提升、无 workspace link、无全局虚拟 store，并关闭 autoInstallPeers 与 dedupePeerDependents。原 TypeScript/CSS/配置解析语义检查保持完整。

新增验证从真实消费者 owner 加载 Babel 与插件，执行 TypeScript/CommonJS 和 Vue JSX 转换；从 core 加载 MCP Node adapter，建立实际 Node handler。消费者必须通过安装树内的真实路径加载，不能使用仓库链接或由应用补入内部 Babel/MCP 宿主掩盖缺声明。测试检验可执行模块语义，不只比对 manifest 字段。

## 验证与交付

先保留原严格安装首错，再以相同档案和合法用户 peer 缩小失败；修复后重建 owning packages，在新 tarball 消费者中验证严格安装和模块语义。随后为新提交重建正式功能矩阵绑定，保留原 Dashboard 图、入口、协议、浏览器、预算和资源门禁。最小安装诊断不能替代正式功能矩阵、性能或真实 IDE 验收。

每次失败保存实际退出、首错与资源收尾；资源终结不将产品失败改写为通过。原失败档案、绑定和记录保持独立，后继结果明确标注提交归属。
