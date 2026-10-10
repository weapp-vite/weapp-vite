# repoctl 上游修复与补丁移除

日期：2026-10-11。

repoctl 5.10.1 已包含重复更新 Release PR 的修复，但显式变更类型和正文中的依赖引用仍需下游补丁。本轮把两处剩余修复提交至上游，在正式 npm 版本发布后升级本仓库并移除补丁。

## 上游问题与修复

- Issue：https://github.com/icelib/repoctl/issues/1062
- 修复 PR：https://github.com/icelib/repoctl/pull/1063
- 既有 PR 去重修复：https://github.com/icelib/repoctl/pull/1060

发布说明解析现在优先使用清理 Markdown 元数据后的显式 Conventional Commit 类型，支持 scope 和 `!`。提及依赖版本、版本箭头或 Dependencies 字样的显式说明保留正文；真正的依赖传播段落仍归维护类，无显式类型的历史说明保留来源提交和关键词回退规则。

回归使用构建产物的公开 API，覆盖 changeset、真实 pnpm version、Release PR、tagged changelog repair 和 publish/ensureRelease 往返。GitHub 与 npm 发布写入使用 mock，不把测试输出当作真实发版。

## 验证证据

- 修改前：18 项回归中 13 项失败、5 项历史兼容用例通过。
- 修改后：发布分类及 GitHub PR 回归 50 项通过。
- 上游全仓 build、lint 通过；核心包 typecheck、tsd 通过。
- 上游全仓 354 个测试文件、2,135 项测试通过；31 项类型任务和 4 项 dev 场景通过。
- 正常 Husky、lint-staged、pre-push 验证通过。

本机默认 pnpm 10 不支持部分原生 version/lane fixture，使用上游声明的 pnpm 12.10.1 完成验证。另排除了旧父 checkout 的可选插件对嵌套 worktree 的类型解析干扰；未为环境问题改动产品源码或断言。

## 正式发布与下游升级

- 修复 PR 与版本 PR 的两轮 Windows/macOS/Linux × Node 22/24 六组 CI 全部通过。
- 版本 PR：https://github.com/icelib/repoctl/pull/1064
- 正式发布工作流：https://github.com/icelib/repoctl/actions/runs/38082027889
- repoctl 5.10.2：https://github.com/icelib/repoctl/releases/tag/repoctl%405.10.2
- 核心包 5.10.2：https://github.com/icelib/repoctl/releases/tag/%40icebreakers/monorepo%405.10.2

两个包已在 registry.npmjs.org 确认可见，repoctl 精确依赖 @icebreakers/monorepo 5.10.2。实际版本 PR 和最终 GitHub Release 均保留完整修复说明并归入 Bug Fixes；真正的依赖传播条目仍归入 Maintenance。

## 下游验证与交付

本仓库将 repoctl 精确升级到 5.10.2，删除 `patches/@icebreakers__monorepo@5.10.1.patch`、workspace 补丁配置及锁文件中的补丁哈希。锁文件只改变 repoctl 与核心包的版本和完整性信息，没有刷新其他依赖。

| 检查 | 结果 |
| --- | --- |
| 实际安装版本 | repoctl 与 @icebreakers/monorepo 均为 5.10.2，使用正式 npm 包 |
| 普通安装及冻结安装 | 通过 |
| 发布分类、PR 去重更新及发布流程回归 | 13 个文件、179 项通过，1 项按原配置跳过；GitHub/npm 写入为 mock |
| workspace 同步、Rolldown 单版本 | 通过，Rolldown 仍为单一 1.2.13 |
| catalog、create-weapp-vite、可发布包与 intent frontmatter 检查 | 通过 |
| 保留边界 | TypeScript 6.0.3；Vite 8.3.4 与 Rolldown 1.2.13 补丁保留 |

升级后 pnpm audit 仍为 47 项（low 5、moderate 18、high 17、critical 7），与前次全仓升级后的结果一致；不添加 override 或忽略项。独立 npm runner 的清单和锁文件未改动，本轮未重复运行其审计。

复现命令：

```sh
pnpm install --frozen-lockfile
pnpm test:release
node scripts/postinstall-sync.mjs --check
pnpm check:rolldown:single-version
pnpm check:catalog-changeset
pnpm check:create-weapp-vite-changeset
pnpm check:publishable-workspace-changeset
pnpm check:changeset:frontmatter
pnpm exec eslint package.json pnpm-workspace.yaml CONTRIBUTING.md docs/plans/2026-10-11-dependency-upgrade.md docs/plans/2026-10-11-repoctl-upstream-fix.md --max-warnings=0 --no-warn-ignored
```

本次仅升级私有开发工具并移除其补丁，不修改小程序运行时或发布包产物，因此不新增 changeset，也未重复运行应用、浏览器或真实 IDE E2E。原全仓依赖升级的验证范围与限制继续保留在原报告中。本次提交使用 `chore(deps)`，通过正常 Husky/lint-staged 检查后单独推送。
