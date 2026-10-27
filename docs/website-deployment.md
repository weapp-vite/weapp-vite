# Website 构建与部署

网站通过 repoctl 的原生 Cloudflare Workers provider 部署。`main` 最新源码对应预览文档；正式文档对应已成功发布的稳定版本。两个渠道使用独立 Worker，自定义域名不会互相覆盖。

| 渠道 | Worker | 域名 | 配置 |
| --- | --- | --- | --- |
| preview | `weapp-vite-preview` | <https://preview.vite.weapp.dev> | `website/wrangler.preview.jsonc` |
| stable | `weapp-vite` | <https://vite.weapp.dev>、<https://vite.icebreaker.top> | `website/wrangler.jsonc` |

`repoctl.config.ts` 固定非敏感的账户身份、Worker、域名和站点覆盖的产品包；凭据仍使用现有 GitHub Secrets。预览页面带提示条、全站 `noindex`、禁止抓取的 `robots.txt` 和响应头；canonical 保持正式域名。未指定渠道的本地构建默认为 preview。

## 触发规则

| 事件 | 行为 |
| --- | --- |
| push 到 main | **Documentation** 选择该提交构建 preview；部署前核验仍为最新 main |
| PR（包括 fork） | 原有 **PR CI** 审批后仅测试、构建、dry-run 和保存 artifact，不使用 Cloudflare 凭据 |
| main/latest 发布成功 | **Release** 使用真正完成的 release record 部署 stable |
| 手动 **Documentation** | 选择 preview 精确源码、stable 完成记录或允许的文档修正提交，支持同一身份重试 |
| 手动 **Deploy Website** | 保留原有 `pr-number` 诊断入口，只验证，不部署 |

preview 与 stable 分别使用 `docs-website-preview`、`docs-website-stable` Environment 和同名 concurrency group。不同渠道独立执行，同一渠道不取消正在发布的任务。GitHub concurrency 不保证队列顺序，因此不能假设每次 push 都产生部署。

首次接入不会创建假的 stable 完成记录。已有线上正式文档继续服务，直到下一次真实 main/latest 发布完成并通过文档覆盖检查。`alpha`、`beta`、`rc`、`next` 和 nightly 不触发 stable 文档发布。

## 构建与验证

使用根目录固定的 pnpm 版本与 Node 24。在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm docs:build
pnpm --filter website-weapp-vite deploy:preview:dry-run
```

`docs:build` 先构建网站的 workspace 依赖并刷新注入链接，随后执行网站单测、直接运行包含 `seo:prepare` 的 VitePress 构建，最后检查实际生成的页面与资源。网站构建不依赖 Turbo 站点缓存；普通 Turbo 的网站任务也显式记录渠道环境输入。

产物检查覆盖首页、指南页、404、JS/CSS、LLM 索引、SEO 报告、canonical、预览提示和爬虫策略。只有 stable 生成 sitemap。`robots.txt` 和 `_headers` 通过 Vite 原生 emit 写出，不在构建后手工改写 bundle。VitePress 的内建 404 在客户端挂载主题，静态 HTML 单独补齐 SEO；浏览器回归包含未知路由。

需要复现稳定版产物时，可在执行环境中设置 `REPO_DOCS_CHANNEL=stable` 后运行相同构建命令。仅构建不需要 release record 或发布凭据。不要把本地产物直接推到生产来绕过 repoctl 的来源核验。

PR 产物保留 7 天，验证入口继续使用冻结的 PR revision。网页测试默认 headless；渠道回归入口是：

```sh
pnpm --filter website-weapp-vite exec playwright test tests/deployment.spec.ts
```

## 部署身份与凭据

现有仓库 Secrets 继续使用：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 发布与查询目标 Worker，并管理配置中的自定义域名 |
| `CLOUDFLARE_ACCOUNT_ID` | 与配置中冻结的账户身份核对 |

部署 workflow 使用 `contents: write` 维护 repoctl 的文档状态与完成记录；候选 PR 验证只有只读权限。无需 GitHub App 或 PAT。Cloudflare Token 按 [官方 GitHub Actions 指引](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)限定在目标账户与对应 zone；凭据只在部署阶段注入。

原生 provider 在产物中加入 `/.well-known/repoctl-deployment.json`，发布后核验 Cloudflare 最新活跃版本及其完整身份，再检查公共域名的身份文件。检查完成前不会推进文档状态中的 current。单纯 Wrangler 返回成功不等于渠道部署完成。

## 手动部署、修正与恢复

从默认分支运行 **Documentation**，站点选择 `website`：

- preview：选择 `preview`，`source-sha` 可指定当前 main 的精确 commit。
- stable 重试：选择 `stable`，`release` 填原来已完成的稳定发布 ID。
- stable 文档修正：使用同一真实发布 ID，并在 `commits` 填已合入 main 的单父提交。仅允许配置列出的文档和静态图片路径；产品源码或配置变更不能混入修正。

失败后保留原 release、修正提交和部署身份进行重试。公共 readiness 超时后，repoctl 复核已上传版本并继续确认，不重新上传或发布 npm 包。不要手改状态、伪造发布完成记录，或通过重新发布包来重试文档。

Cloudflare Workers Builds 应保持断开，避免另一个流程直接覆盖原生部署。断开构建集成不需要删除 Worker 或解绑现有域名，参见 [Disconnecting builds](https://developers.cloudflare.com/workers/ci-cd/builds/#disconnecting-builds)。

遇到凭据或权限失败时，核对 Secret、冻结账户和自定义域名权限。需要紧急 Cloudflare 回滚时，先暂停对应部署入口，记录回滚版本并检查域名、直达页面、资源与 404；恢复流程前核对远端身份与 repoctl 状态，不能用旧 workflow 绕过新来源检查。
