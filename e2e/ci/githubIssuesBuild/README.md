# GitHub Issues 构建回归

新增 issue 构建回归时，在 `cases/` 下新增 `issueNNN.case.ts`，并导出 `registerGithubIssuesBuildCase(context)`。入口会自动发现并注册这些文件，不要再向 `github-issues.build.test.ts` 或 `legacy.ts` 追加用例。

- 可复用标准构建时调用 `context.runStandardBuild()`，避免重复构建完整应用。
- 需要特殊配置时，新增同名 `issueNNN.config.ts`，继承基础配置并通过 `configFile` 传给构建 helper；不要向 app 的共享配置追加 issue 条件分支。
- 需要独立环境变量或输出目录时，在当前 issue case 中封装专用构建。
- 注册函数必须同步声明 `it(...)`；异步工作放在测试回调内部。
- `legacy.ts` 仅承载尚未迁移的历史用例，后续按改动范围渐进迁移。
