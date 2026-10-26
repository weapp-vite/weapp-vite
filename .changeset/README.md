# Changeset 编写说明

用户可见的功能、运行时修复、构建行为或公开 API 变化需要 changeset；纯测试、文档和内部维护通常不需要。涉及 `weapp-vite`、`wevu` 或模板发布时，同时为 `create-weapp-vite` 添加版本变更。

每个 changeset 使用 `.changeset/*.md` 文件，文件开头直接写成对的 `---` 分隔线。frontmatter 中使用 workspace 内对应 `package.json` 的真实 `name`，例如 `weapp-vite`、`create-weapp-vite`、`wevu` 或 `@weapp-vite/web`；不要使用目录路径或自行缩写。版本变更填写 `patch`、`minor` 或 `major`。

版本级别按当前包对用户的影响选择：兼容修复和兼容依赖更新使用 `patch`，向后兼容的新增能力使用 `minor`，破坏性变更通常使用 `major`。依赖自身升级 major 不自动意味着当前包也要 major；应检查公开 API、运行环境和可观察行为是否受影响。

2026-10-26 的依赖升级按维护者确认的例外策略，将涉及 Node 支持范围收紧和公开行为迁移的 40 个包统一以 `minor` 发布，原有两个 `patch` 保留。该例外仅适用于本轮升级，必须保留 `chore(deps)!`、Node 下限、构建队列和截图比较算法的迁移说明，不宣称完全向后兼容。既有 fixed 组继续按最高版本级别联动。

```md
---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复组件首次挂载时的样式更新。
```

frontmatter 后的**首个非空行**必须是 Conventional 格式的中文摘要，描述用户能感知的结果：

```text
type(scope)!: 中文摘要
```

- `type` 允许 `feat`、`fix`、`perf`、`chore`、`docs`、`refactor`、`test`、`build`、`ci`、`style`、`revert`。
- `(scope)` 可省略；填写时不能为空，也不能包含空白或括号。
- `!` 可省略，用于标记破坏性变更，放在类型或 scope 后、冒号前。
- 冒号后至少保留一个空白，并填写非空摘要；不要把 Markdown 标题或列表标记放在摘要前。

其他有效摘要示例：`perf: 缩短模板增量构建时间。`、`feat(web)!: 调整页面导航接口。`

提交前检查当前工作区的全部 changeset：

```sh
pnpm check:changeset:frontmatter
```

检查本次暂存的 changeset：

```sh
node scripts/check-changeset-frontmatter.mjs --staged
```

Husky `pre-commit` 和 `lint-staged` 均校验 Git 索引中的实际暂存快照，包名也以该快照为准。部分暂存时，工作区中的修正不会自动修复索引：先审阅并重新暂存需要提交的内容，再运行 staged 检查；不要跳过 hooks。此 README 不作为待发布的 changeset 校验。
