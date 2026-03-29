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

不属于 npm 包内交付文档的内容，例如：

- 架构设计说明
- AST / 编译器实验记录
- benchmark 分析
- 阶段性排障报告

应当移动到仓库根目录 `docs/` 下对应的主题目录，而不是继续放在 `packages/weapp-vite/docs/`。
