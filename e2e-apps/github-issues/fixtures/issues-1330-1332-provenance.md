# 三个作者原始复现

来源为 issue 作者提供的 [复现仓库](https://github.com/Alddp/weapp-vite-bug-report)，固定在提交 `79e4b473354acb7439d1985a21942922e38a7af8`，其三个 example 与对应 issue 的原始提交内容一致。

| Issue | 原 example | 原始提交 |
| --- | --- | --- |
| #1330 | examples/format-wxml | 7a0e78803a89b3243528635f2d3fb7588fce44e7 |
| #1331 | examples/initial-props | 26aad81c19cd5076289ca60ccb8d3a896916636b |
| #1332 | examples/external-script | 79e4b473354acb7439d1985a21942922e38a7af8 |

原始业务源码和配置保持原样。宿主配置仅固定为仓库通用 AppID，并新增 `project.private.config.json` 的原页面启动条件。原 `README.md` 和 `verify.mjs` 用于记录修复前缺陷，后者会断言缺陷存在，不作为修复后的通过门禁。

正式回归入口为 `e2e/ide/issue-1330.runtime.test.ts`、`issue-1331.runtime.test.ts`、`issue-1332.runtime.test.ts`，由真实 DevTools 和 headless 共用；通过当前 workspace 的公共 CLI 运行作者原配置。
