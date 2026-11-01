## Node.js 支持范围

框架及编译依赖链的官方支持范围为 `^22.23.4 || ^24.22.1 || >=26.12.1`：Node 22 至少 22.23.4、Node 24 至少 24.22.1，或 Node 26.12.1 及以上版本。Node 20、23、25 及低于上述最低版本的环境不在官方支持范围内。

CLI（含 `prepare`）与 Tailwind 集成发现实际 Node 版本超出该范围时，会提示升级并继续尝试执行，不会仅因版本号退出。旧版 Node 若缺少依赖所需的语法或 API，仍可能导致加载或执行失败；直接通过 Vite 或程序 API 消费时也受实际依赖兼容性限制。

建议升级至受支持 LTS 分支的最新安全补丁版本，再安装或更新依赖。包的 `engines.node` 声明保持不变；如果项目或团队启用了严格 engines 校验，包管理器仍可能拒绝安装。

`create-weapp-vite` 与框架采用相同的 Node 支持范围；Vite+ 模板要求 `^24.22.1 || >=26.12.1`。

发布候选在构建环境中打包，再在独立临时消费者中以严格 engines/peer 校验安装；CI 覆盖 Linux、Windows、macOS 的 Node 22.23.4、24.22.1、26.12.1 及 22/24 当前补丁版本，验证原生和 SFC 构建、prepare 与公开类型。

# weapp-vite docs 目录说明

`packages/weapp-vite/docs` 只存放两类内容：

1. 直接服务于 `weapp-vite` npm 包使用者的说明文档。
2. 作为 `dist/docs` 打包源文件维护的本地文档。

当前目录约定如下：

- `mcp.md`
- `volar.md`
- `define-config-overloads.md`
- `packaged/*.md`

其中：

- `mcp.md`、`volar.md`、`define-config-overloads.md` 会直接同步到 `dist/docs/`。
- `packaged/*.md` 是 `dist/docs/` 的维护源文件，不要再把生成结果反向放回本目录。
- `packaged/testing.md` 维护 mpcore 页面/组件测试与 `weapp-vite/test` 程序化构建入口说明。

不属于 npm 包内交付文档的内容，例如：

- 架构设计说明
- AST / 编译器实验记录
- benchmark 分析
- 阶段性排障报告

应当移动到仓库根目录 `docs/` 下对应的主题目录，而不是继续放在 `packages/weapp-vite/docs/`。
