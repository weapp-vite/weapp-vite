# Website 构建与部署

网站由 GitHub Actions 的 **Deploy Website** workflow 构建，再通过仓库锁定版本的 Wrangler 发布到现有 Cloudflare Worker `weapp-vite`。Cloudflare 负责静态资源托管，不再通过 Workers Builds 构建仓库。

部署配置以 `website/wrangler.jsonc` 为准，产物目录为 `website/dist`，正式域名为：

- <https://vite.weapp.dev>
- <https://vite.icebreaker.top>

## 触发规则

| 事件                               | 构建、测试、dry-run        | 正式部署                       |
| ---------------------------------- | -------------------------- | ------------------------------ |
| push 到 main                       | 执行                       | 仅提交仍为 main 最新版本时执行 |
| 目标分支为 main 的 PR（包括 fork） | 执行，无需 Cloudflare 凭据 | 不执行                         |
| 手动运行，选择 main                | 执行                       | 仅提交仍为 main 最新版本时执行 |
| 手动运行，选择其他分支或标签       | 执行                       | 不执行                         |

workflow 不设置路径过滤，因为网站还引用仓库中的文档、脚本和 workspace 包。PR 的新运行会取消同一 PR 的旧运行。生产运行使用同一个 concurrency group，不取消正在执行的发布；部署前重新读取 main，跳过已过期的提交。GitHub concurrency 不保证排队顺序，新的等待任务可能替换原有等待任务，因此不要依赖每次 push 都产生一次部署。

## 构建过程

运行环境为 Ubuntu、Node 24，pnpm 版本读取根目录 `packageManager`。checkout 获取完整历史，以保留 VitePress 页面的最后更新时间。任务超时为 90 分钟，仅复用现有 pnpm 下载缓存，不配置跨运行的 Turbo 构建缓存。

在仓库根目录运行以下命令可复现构建：

```sh
pnpm install --frozen-lockfile
pnpm exec turbo run build --filter='website-weapp-vite^...'
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter website-weapp-vite test
pnpm --filter website-weapp-vite build
pnpm --filter website-weapp-vite deploy:dry-run
```

依赖构建及后续安装复用 `.github/actions/refresh-workspace-deps`，只执行一次依赖构建。网站读取 `weapp-vite/compatibility` 等包产物，需要先完成这些构建并刷新 workspace 链接。

网站 Vitest 禁用 OXC 自动查找 tsconfig，避免读取 E2E fixture 常量时依赖该小程序尚未生成的 `.weapp-vite` 配置；文档单测无需启动或构建小程序应用。

网站本身直接执行 package build，包含 `seo:prepare`。不要改为复用网站的 Turbo 构建缓存：当前通用任务输入未完整覆盖 Markdown、`.vitepress` 和网站引用的外部文件，可能发布旧页面。

发布前会检查首页、指南页、404、JS/CSS、sitemap、LLM 索引、SEO 报告及 `_headers`，再执行不需要凭据的 Wrangler dry-run。验证成功的 `website/dist` 会作为当前运行的 artifact 保存 7 天。构建、验证或上传失败时不会继续部署。

正式发布使用 `pnpm --filter website-weapp-vite run deploy`。必须保留 `run`，否则 pnpm 会执行自身用于打包 workspace 的内置 `deploy` 命令，而不是网站的 Wrangler 脚本。

## 部署凭据

在 GitHub 仓库 **Settings → Secrets and variables → Actions → Repository secrets** 配置：

| Secret                  | 用途                                 |
| ----------------------- | ------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | 授权 Wrangler 发布 Worker            |
| `CLOUDFLARE_ACCOUNT_ID` | 指定现有 Worker 所属 Cloudflare 账户 |

按 [Cloudflare GitHub Actions 指引](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)创建 Token：使用 **Edit Cloudflare Workers** 模板，并将权限限定在目标账户及 `weapp.dev`、`icebreaker.top` 对应 zone，保留发布 Worker 和管理配置中自定义域名所需的权限。

凭据只注入正式部署步骤，不写入仓库、构建产物或日志。缺少任一 Secret 时，正式部署明确失败；PR 验证不受影响。GitHub workflow 只申请 `contents: read`。

## 从 Workers Builds 切换

1. 完成本地验证及 PR 的 **Deploy Website** 构建验证。
2. 配置上述 GitHub Secrets，核对账户中已有 Worker 名称为 `weapp-vite`，两个域名都属于该 Worker。
3. 在 Cloudflare **Workers & Pages → weapp-vite → Settings → Builds → Disconnect** 断开 Git 构建集成，并取消仍在排队或运行的旧构建。此操作保留当前 Worker、域名和线上部署；不要删除 Worker 或解绑域名。
4. 合入 main，观察 GitHub **Actions → Deploy Website**。需要重试时使用 **Run workflow** 并选择 main。
5. 在 Wrangler 部署日志中记录版本 ID及对应 commit SHA。分别检查两个域名的首页、`/guide/`、JS/CSS 加载及不存在路径返回的 HTTP 404。
6. 后续 main 更新应仅通过 GitHub Actions 发布；确认 Cloudflare Builds 不再自动启动。

断开集成的操作说明见 [Cloudflare Disconnecting builds](https://developers.cloudflare.com/workers/ci-cd/builds/#disconnecting-builds)。仅把旧流程的部署命令改为 `versions upload` 仍会触发构建，不能解决构建超时问题。

## 故障处理与回滚

- 构建或 dry-run 失败：查看对应步骤日志；正式部署不会开始，当前线上版本继续服务。
- 凭据或权限失败：检查两个 Secret、账户和 Token 权限，再重跑 main 最新提交。不要在日志中输出凭据。
- 运行显示过期提交：查看更新的 main 运行；旧运行会保留构建 artifact，但不会覆盖生产。
- 发布后发现页面异常：在 Cloudflare 中将 Worker 回滚到已记录的上一正常版本，并暂停新的生产发布，避免后续 main 更新覆盖回滚。也可在已认证环境从仓库根目录运行：

```sh
pnpm --filter website-weapp-vite exec wrangler rollback <VERSION_ID>
```

回滚后重复域名、文档直达、资源和 404 检查；修复合入 main 后恢复 workflow。生产回滚使用 Cloudflare 版本，不通过重跑旧 GitHub workflow 绕过最新提交检查。
