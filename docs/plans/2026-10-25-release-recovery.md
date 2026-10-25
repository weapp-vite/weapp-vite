# PR #1188 发布补充记录

本批版本首次进入 main 的提交为 `8c524bc1dc598822391175f17aa40314fd1b8521`。其中已经包含 MCP 服务从包清单读取版本的代码修复，目标版本为 `@weapp-vite/mcp@2.1.0`。

修复 PR CI 时新增的 `mcp-release-version` intent 晚于版本准备，导致同一提交同时包含已准备版本和待消费 intent。自动发布因此选择再次准备版本，并被“先完成已准备发布”的检查拒绝。

首次恢复又把补充说明加入已准备的 MCP changelog。质量检查通过后，upload 阶段要求当前 changelog 与版本首次准备提交一致，因此再次拒绝；原始进度记录为已上传 0 个、待上传 42 个，精确 registry 查询也确认目标版本均不存在。

恢复保留原准备提交中的版本、changelog 和 ledger；迟到 intent 的完整信息保存在本记录中。正式发布沿用冻结的 release notes，本文是额外维护记录，没有声明 pnpm 重新消费该 intent，也没有为它制造新的来源提交。

原 intent ID：`mcp-release-version`。

```yaml
'@weapp-vite/mcp': patch
```

原说明：

> fix(mcp): 从包清单读取服务版本，避免发布升级后协议返回的版本仍停留在旧版本。

处理发布 PR 中的新修复时，应在提交前检查版本准备来源、待消费 intent 和发布器的来源冻结规则。npm 的 404 只证明版本不存在，不能证明已有准备元数据允许修改。恢复发布需继续核对阶段回执、registry 可见性、标签、归档与内部依赖。
