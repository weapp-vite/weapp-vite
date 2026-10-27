# GitHub Issues 构建回归

新增 issue 构建回归时，在 `cases/` 下新增 `issueNNN.case.ts`，并导出 `registerGithubIssuesBuildCase(context)`。入口会自动发现并注册这些文件，不要再向 `github-issues.build.test.ts` 或 `legacy/cases/` 追加用例。

- 可复用标准构建时调用 `context.runStandardBuild()`，避免重复构建完整应用。
- 需要特殊配置时，新增同名 `issueNNN.config.ts`，继承基础配置并通过 `configFile` 传给构建 helper；不要向 app 的共享配置追加 issue 条件分支。
- 需要独立环境变量或输出目录时，在当前 issue case 中封装专用构建。
- 新增独立 fixture 时，若包含 `project.private.config.json`，必须在其中显式设置 `setting.urlCheck: false`，与公共项目配置保持一致。提交前运行 `pnpm vitest run scripts/miniprogram-url-check.test.ts --project repo-scripts`，检查所有已跟踪的小程序项目配置。
- 注册函数必须同步声明 `it(...)`；异步工作放在测试回调内部。
- 每个模块声明 `group`，标准产物断言归入 `standard`，同配置的 sourcemap 断言归入 `sourcemap`，特殊配置使用独立分组。分组必须在 `groups.ts` 声明独立入口，不能只拆辅助模块而继续集中到一个任务。
- `legacy/cases/` 保留历史用例的原断言与注册次序；新增用例继续放在 `cases/`。
- `optimized-v1` 使用原聚合入口，`optimized-v2` 只使用分组入口；正式清单和直接 CI Vitest 发现范围均保证两者不重复执行。每台 runner 保持串行，不能并发写共享 fixture 或 `.weapp-vite` 支持文件。
