## Node.js 支持范围

框架及编译依赖链要求 `^22.18.0 || ^24.11.0 || >=26.0.0`：Node 22 至少 22.18.0、Node 24 至少 24.11.0，或 Node 26 及以上版本；不支持 Node 20、23、25。这是 Babel 8 与必需构建依赖支持范围的交集，不能通过关闭 engines 校验恢复旧版本支持。

升级已有项目时先升级 Node.js，再重新安装依赖。CLI 会在加载编译依赖前检查实际 Node 版本；`prepare` 也会明确拒绝不支持的环境。直接通过 Vite 或程序 API 消费时同样需要遵守包的 `engines.node`。

`create-weapp-vite` 自身依赖要求更高：Node 22 至少 22.22.2、Node 24 至少 24.15.0，或 Node 26 及以上版本。新建项目按脚手架要求选择 Node，不要将框架最低版本误认为脚手架最低版本。

发布候选在构建环境中打包，再在独立临时消费者中以严格 engines/peer 校验安装；CI 覆盖 Linux、Windows、macOS 的 Node 22.18.0、24.11.0、26.0.0 及 22/24 当前补丁版本，验证原生和 SFC 构建、prepare 与公开类型。

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
