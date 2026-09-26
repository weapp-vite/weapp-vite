---
title: 上传环境与自动版本
description: 配置 .env.test 和 .env.production，切换业务接口、上传凭据与 AppID，并用本地脚本或 CI 自动生成上传版本和说明。
keywords:
  - env
  - test
  - production
  - AppID
  - 自动版本
  - CI
---

# 上传环境与自动版本

**通常不需要配置 `weapp.upload`。** 不传 `--uv` 时读取业务项目的 `package.json.version`；不传 `--desc` 时自动生成 `项目名@版本`。它不会自动递增版本，也不要求每次上传都手改 `vite.config.ts`。

| 需求 | 方案 |
| --- | --- |
| 同一 AppID，切换测试/正式接口与凭据 | [环境文件 + `--mode`](#env) |
| 测试、正式使用不同 AppID | [按 mode 选择项目 JSON](#appid) |
| 本地每次上传自动升版、取 Git 提交说明 | [一个脚本](#local-version) |
| CI 自动版本、说明与环境凭据 | [GitHub Environments](#ci) |

## 1. 同一 AppID：环境文件与命令 {#env}

以下文件都在**业务项目根目录**；先按[对应平台指南](../upload.md)准备可构建的项目、项目 JSON 和 SDK。

`.env.test`（可提交，只放公开业务配置）：

```dotenv
VITE_API_BASE_URL=https://test-api.example.com
```

`.env.production`：

```dotenv
VITE_API_BASE_URL=https://api.example.com
```

业务源码使用 `import.meta.env.VITE_API_BASE_URL`。`VITE_` 变量会进入客户端，**不能放密钥**。

`.env.test.local`（不提交，只保留使用的平台）：

```dotenv
XHS_UPLOAD_TOKEN=replace-with-test-xhs-token
TT_UPLOAD_TOKEN=replace-with-test-douyin-token
```

`.env.production.local`：

```dotenv
XHS_UPLOAD_TOKEN=replace-with-production-xhs-token
TT_UPLOAD_TOKEN=replace-with-production-douyin-token
```

同一 AppID 应使用该应用当前有效的凭据；文件分开不代表平台允许同时存在两份有效 Token。其他平台在上述两个 `.local` 文件中使用相同变量名、不同环境的值：

| 平台 | 变量 | test 示例 / production 示例 |
| --- | --- | --- |
| 微信 | `WEAPP_CI_PRIVATE_KEY_PATH` | `.keys/test/weapp.key` / `.keys/production/weapp.key` |
| 支付宝 | `ALIPAY_IDENTITY_KEY_PATH` | `.keys/test/alipay.json` / `.keys/production/alipay.json`，须为官方身份密钥 JSON |
| 京东 | `JD_PRIVATE_KEY` | 对应环境的完整密钥内容，不是路径 |
| 百度 | `SWAN_UPLOAD_TOKEN`、`SWAN_MIN_VERSION` | 对应环境的 BDUSS、最低基础库版本；后者不是应用版本 |

文件型密钥必须实际存在，路径相对业务项目根，而非 `.env` 文件或 `dist`。凭据获取步骤见[微信](./weapp.md)、[支付宝](./alipay.md)、[京东](./jd.md)、[百度](./swan.md)。

`.gitignore`：

```text
.env.local
.env.*.local
.keys/
```

从业务项目根执行，不需要传版本和说明：

```sh
# 测试环境：先检查，再上传或预览
pnpm exec wv build --upload -p xhs --mode test --dry-run
pnpm exec wv build --upload -p xhs --mode test
pnpm exec wv preview -p xhs --mode test

# 正式环境：仍只上传开发版本，不自动提审/上线
pnpm exec wv build --upload -p xhs --mode production --dry-run
pnpm exec wv build --upload -p xhs --mode production
pnpm exec wv preview -p xhs --mode production
```

抖音将 `-p xhs` 改为 `-p tt`，其他平台同理。`--mode test` 仍是生产构建，只切换 mode、环境文件与配置函数；它不是平台的开发版/体验版/正式版开关。

加载优先级由低到高：`.env` → `.env.local` → `.env.<mode>` → `.env.<mode>.local` → **进程环境变量**。不要把仅供 production 的凭据放入所有 mode 都加载的 `.env.local`。CI Secrets 或终端已有的同名变量会覆盖文件；不要使用保留的 `--mode local`。自定义 `root` / `envDir` 的路径规则见[总览](../upload.md#environment)。

## 2. 不同 AppID：按 mode 选择项目 JSON {#appid}

只切 Token 不会切 AppID。推荐使用已有的多平台配置目录能力，即使只上传一个平台，也可只保留一个 target。

完整 `vite.config.ts`（已有项目保留原框架插件）：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig(({ mode }) => {
  if (mode !== 'test' && mode !== 'production') {
    throw new Error('请使用 --mode test 或 --mode production')
  }
  return {
    weapp: {
      srcRoot: 'src',
      multiPlatform: {
        enabled: true,
        targets: ['xhs', 'tt'],
        projectConfigRoot: `config/${mode}`,
      },
    },
  }
})
```

目录：

```text
config/
  test/
    xhs/project.config.json
    tt/project.config.json
  production/
    xhs/project.config.json
    tt/project.config.json
src/
vite.config.ts
.env.test
.env.test.local
.env.production
.env.production.local
```

`config/test/xhs/project.config.json`：

```json
{
  "appid": "replace-with-test-xhs-app-id",
  "compileType": "miniprogram",
  "miniprogramRoot": "dist"
}
```

`config/production/xhs/project.config.json`：

```json
{
  "appid": "replace-with-production-xhs-app-id",
  "compileType": "miniprogram",
  "miniprogramRoot": "dist"
}
```

两份抖音 JSON 使用相同字段，分别填写测试、正式的抖音 AppID；两个 `.env.<mode>.local` 中的 Token 必须授权给该 mode 下的应用。小红书/抖音可选的 `XHS_APP_ID` / `TT_APP_ID` 若设置，必须与 JSON 完全一致，不能用来覆盖另一应用。

其他平台按分篇使用标准文件名：微信/京东 `project.config.json`、支付宝 `mini.project.json`、百度 `project.swan.json`；百度代码根字段为 `smartProgramRoot`。文件均放在 `config/<mode>/<平台>/`。

```sh
# 本配置开发时也显式选 mode
pnpm exec wv dev -p xhs --mode test

# 单平台：同时选择该环境的 JSON、AppID、Token 和业务变量
pnpm exec wv build --upload -p xhs --mode test
pnpm exec wv build --upload -p xhs --mode production

# 两个平台串行上传；不要把 all 当成已配置 targets 的缩写
pnpm exec wv upload -p xhs,tt --mode test
pnpm exec wv upload -p xhs,tt --mode production
```

上述配置默认仍写入 `dist/<平台>/dist/`，并将本轮选中的项目 JSON 复制至 `dist/<平台>/`。**mode 不会自动生成 `dist/test`、`dist/production`**；切换环境会重建同一输出，不复用旧包。需要并行或同时保留两套产物时，使用独立工作区/CI job，并按环境命名归档。不要手改生成 JSON，也不要在同一工作区并发上传不同环境。启用多平台模式后不再使用 `--project-config`。

## 3. 本地：一条命令自动升版和取提交说明 {#local-version}

如果不要求每次上传都升版，直接使用前面的命令即可。需要自动递增时，在业务项目安装 `tinyexec`（本例使用 1.3.1+，包含 Windows 命令解析与参数转义）：

```sh
pnpm add -D tinyexec@^1.3.1
```

创建 `scripts/upload.mjs`，需要 Node/npm 和已有提交的 Git 仓库：

```js
import { x } from 'tinyexec'

const [mode = 'test', platform = 'xhs', ...extra] = process.argv.slice(2)
const { stdout } = await x('git', ['log', '-1', '--pretty=%s'], { throwOnError: true })

await x('npm', [
  'version',
  'patch',
  '--no-git-tag-version',
  '--ignore-scripts',
], { throwOnError: true, nodeOptions: { stdio: 'inherit' } })

await x('pnpm', [
  'exec',
  'wv',
  'build',
  '--upload',
  '-p',
  platform,
  '--mode',
  mode,
  `--desc=${stdout.trim()}`,
  ...extra,
], { throwOnError: true, nodeOptions: { stdio: 'inherit' } })
```

```sh
node scripts/upload.mjs test xhs
node scripts/upload.mjs production tt

# 验证脚本：仍会本地升版，但不会调用上传 SDK
node scripts/upload.mjs test xhs --dry-run
```

例如 `package.json.version` 从 `1.2.3` 变为 `1.2.4`，CLI 自动读新版本；说明取最后一次 Git commit 的 subject。脚本只构建一次，不修改 `vite.config.ts`，不创建 commit/tag、不 push。**它会修改业务版本文件；后续上传失败不自动回滚。** 本例禁用 npm version 生命周期脚本；pnpm 项目也可以使用此本地版本操作，不执行 `npm install`。

## 4. CI：环境凭据、版本和说明都自动注入 {#ci}

以业务项目位于仓库根目录的小红书上传为例：

1. 在 GitHub 仓库创建 `test`、`production` 两个 **Environment**，各自添加同名 Secret `XHS_UPLOAD_TOKEN`，但值对应各自应用；给 production 设置审批规则。
2. 提交上一节的 `config/test`、`config/production` 及公开 `.env.test`、`.env.production`；不提交 `.local` 和私钥。项目应已安装 `xhs-mp-cli`、提交锁文件，并在 `package.json.packageManager` 固定项目实际使用的 pnpm 版本；工作流从该字段安装，不另设冲突版本。
3. 添加以下工作流。新 workflow run 自动使用 `1.0.<run_number>`；`1.0` 是示例主/次版本，首次接入时按已有版本规划调整，后续不用每次改配置。

```yaml
name: Upload mini program
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [test, production]
        default: test
        required: true
jobs:
  upload:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: 构建并上传选中环境
        env:
          UPLOAD_MODE: ${{ inputs.environment }}
          UPLOAD_VERSION: 1.0.${{ github.run_number }}
          UPLOAD_DESC: ${{ inputs.environment }} @ ${{ github.sha }}
          XHS_UPLOAD_TOKEN: ${{ secrets.XHS_UPLOAD_TOKEN }}
        run: >-
          pnpm exec wv build --upload -p xhs
          --mode "$UPLOAD_MODE" --uv "$UPLOAD_VERSION" --desc "$UPLOAD_DESC"
```

`UPLOAD_MODE` / `UPLOAD_VERSION` / `UPLOAD_DESC` 是这份工作流自己的变量，**不是框架自动读取的内置配置**，因此通过 CLI 显式传入。说明包含环境与提交 SHA；重新运行同一次 workflow 会复用其 run number。三段数字适合跨平台版本格式，但仍需符合平台现有版本的递增/受理规则。

抖音使用 `TT_UPLOAD_TOKEN` 并改为 `-p tt`；其他平台按前面的变量表注入。微信/支付宝私钥需从 Secret 安全写入临时文件，设置对应路径变量并清理，完整步骤见[CI 密钥文件示例](../upload.md#ci)。CI 进程变量优先于 `.env` 文件；只向可信任务提供 Secrets，第三方 SDK 凭据存储随一次性 runner 一起销毁。
