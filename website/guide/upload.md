---
title: 小程序上传与预览指南
description: 从 AppID、密钥与 Token 配置开始，按微信、支付宝、抖音、小红书、京东、百度分别构建上传和预览，说明淘宝支持边界、批量上传、CI 与故障排查。
keywords:
  - upload
  - preview
  - 小红书
  - 抖音
  - 淘宝
  - CI
---

# 小程序上传与预览指南

本指南按“准备项目 → 配置目标平台 → dry-run → 上传或预览 → CI”展开。**上传开发版本不等于提审或正式上线**；审核、发布、体验成员权限和扫码有效期仍由各平台管理。

配置 `.env.test` / `.env.production`、切换 AppID，或不想每次手改版本和说明，直接看[上传环境与自动版本](./upload/environments.md)。

## 选择平台

| 目标   | CLI 平台值 | 安装到业务项目的官方工具 | 分步指南                                            |
| ------ | ---------- | ------------------------ | --------------------------------------------------- |
| 微信   | `weapp`    | `miniprogram-ci`         | [微信：代码上传私钥与 IP 白名单](./upload/weapp.md) |
| 小红书 | `xhs`      | `xhs-mp-cli`             | [小红书：AppID 与上传 Token](./upload/xhs.md)       |
| 抖音   | `tt`       | `tt-ide-cli`             | [抖音：AppID、Token 与版本格式](./upload/tt.md)     |
| 支付宝 | `alipay`   | `minidev`                | [支付宝：JSON 身份密钥](./upload/alipay.md)         |
| 京东   | `jd`       | `jd-miniprogram-ci`      | [京东：上传密钥内容与并发限制](./upload/jd.md)      |
| 百度   | `swan`     | `swan-toolkit`           | [百度：BDUSS 与最低基础库](./upload/swan.md)        |
| 淘宝   | **不支持** | 无统一适配器             | [淘宝不是支付宝上传目标](./upload/alipay.md#taobao) |

Web、组件库和独立插件不在这个小程序上传入口的范围内。只安装实际使用的平台工具；不要因为准备上传小红书就安装其他五套 SDK。这里介绍的是具备这些命令的 `weapp-vite` 版本；若当前安装版本的 `pnpm exec wv build --help` 没有 `--upload`，先升级到包含该能力的版本，不要用旧 IDE 上传参数替代。

## 1. 准备项目与上传默认参数 {#setup}

前提是已有能够运行 `pnpm exec wv build -p <平台>` 的完整小程序项目。框架可以是原生或项目已经使用的框架，不要求为了上传改写页面。新项目先按[快速开始](/guide/)完成初始化；多平台源码适配见[多平台构建](./multi-platform.md)。

下面是小红书单目标项目的最小完整 `vite.config.ts`。**不用添加 `weapp.upload`**；已有项目保留原来的插件、框架及构建设置：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'xhs',
    srcRoot: 'src',
  },
})
```

默认读取业务 `package.json.version`，说明自动生成为 `项目名@版本`，无需每次修改配置；版本不会自动递增。[本地脚本或 CI](./upload/environments.md#local-version)可以自动升版并生成提交说明。`weapp.upload` 仅用于可选的版本/说明覆盖，不接受 AppID 或凭据。

- 版本：`--uv` > `weapp.upload.version` > `package.json.version`。
- 说明：`--desc` > `weapp.upload.desc` > 根据项目名称与最终版本生成的说明。
- 参数保持字符串语义后去除首尾空白；显式空版本会报错，空说明使用默认说明。字符串可以保留前导零，但还要满足目标平台的版本规则。
- 普通构建、开发重建不启用上传；`preview` 不使用 `weapp.upload` 默认参数。
- 配置文件仍会正常加载与合并，上传开关不保证 JavaScript getter 延迟求值。不要在配置文件求值时执行上传副作用。

## 2. 环境文件、密钥和路径 {#environment}

默认将目标平台需要的变量写入源码项目根目录的 `.env.production.local`，只保留使用的平台。各平台页面提供对应的文件内容，所有 `replace-with-...` 都必须替换为自己的值，不是有效凭据。

加载优先级从低到高：`.env` → `.env.local` → `.env.<mode>` → `.env.<mode>.local` → 已有进程环境变量；支持变量展开。上传和预览默认 mode 为 `production`，`--mode test` 改为选择 `.env.test` / `.env.test.local` 等文件，但仍执行生产构建。不要使用保留的 `--mode local`。

| 项目                              | 相对路径基准                                         |
| --------------------------------- | ---------------------------------------------------- |
| 命令的 `[root]`                   | 当前工作目录；省略时使用当前目录                     |
| 环境文件目录                      | Vite `root`；设置 `envDir` 时相对 Vite `root` 解析   |
| 微信 `WEAPP_CI_PRIVATE_KEY_PATH`  | 源码项目根目录，即命令的 `[root]`                    |
| 支付宝 `ALIPAY_IDENTITY_KEY_PATH` | 源码项目根目录，即命令的 `[root]`                    |
| 项目配置内的代码根字段            | SDK 读取的项目配置所在目录，必须指向本次真实构建输出 |

顶层 `envDir: false` 禁用环境文件加载，只读取进程环境。更改 Vite `root` / `envDir` 不会改变两个密钥文件路径的基准。

在业务项目 `.gitignore` 中加入：

```text
.env.local
.env.*.local
.keys/
```

把 `.keys/` 放在源码和静态资源目录之外；不要复制到构建产物。不要给凭据加 `VITE_` 前缀、写入客户端源码、打印到日志或放进命令行参数。CI 应使用 Secrets 或安全文件；不要向不可信 PR 暴露凭据。

## 3. 选择正确的命令 {#commands}

以下命令都从源码项目根目录执行，不是在旧 `dist` 中操作：

```bash
# 只构建，不上传；即使已经配置 weapp.upload 也一样
pnpm exec wv build -p xhs

# 构建并检查产物；不校验凭据、不加载上传 SDK
pnpm exec wv build --upload -p xhs --dry-run

# 复用本次构建，校验产物后上传开发版本
pnpm exec wv build --upload -p xhs

# 独立上传入口也会先构建，不需要先执行一次 build
pnpm exec wv upload -p xhs

# 单独构建预览，不上传开发版本，也不接受 --uv
pnpm exec wv preview -p xhs --desc "验收首页"
```

| 需求                                          | 选择与边界                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 调整 `--outDir`、`--minify` 等构建参数后上传  | `build --upload`，保留 `build` 的选项，不重复构建                                                                           |
| 只验证构建和目录关系                          | 上传或预览命令加 `--dry-run`；上传仍要求非空版本，但不验证凭据、平台专属版本规则、IP 白名单、网络或扫码权限                 |
| 开发时 watch/HMR                              | 不上传；`build --watch --upload` 会报错                                                                                     |
| 普通 build 传 `--uv` / `--desc` / `--dry-run` | 必须同时传 `--upload`，否则报错                                                                                             |
| Web-only                                      | `build -p web --upload` 不支持                                                                                              |
| 上传已经存在的旧产物、不再构建                | 新入口不提供此模式，避免误传旧版本                                                                                          |
| 沿用已登录微信 IDE 的旧脚本                   | 显式使用 `wv ide upload --project <IDE项目根> -v 1.2.3 -d "说明"` 或 `wv ide preview --project <IDE项目根>`；它们不额外构建 |

成功时 CLI 明确区分“上传完成”和“预览已生成”，前者仍未提审、未正式发布。微信预览产生本地二维码图片；支付宝、京东返回二维码图片 URL；抖音、小红书、百度返回扫码目标或预览链接。工具不会自动打开浏览器或修改剪贴板。

## 4. 一份配置与批量上传 {#batch}

单平台可沿用分篇中的原生项目 JSON。多个平台推荐在 **一份 `vite.config.ts`** 中使用 `projectConfigs`，不必手工维护六个文件。公共字段用普通对象展开复用，各平台只填写自己的 AppID 和差异：

```ts
import { defineConfig } from 'weapp-vite/config'

const common = { projectname: 'my-app' }

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    multiPlatform: {
      projectConfigs: {
        weapp: { ...common, appid: 'replace-with-weapp-app-id' },
        alipay: { ...common, appid: 'replace-with-alipay-app-id' },
        tt: { ...common, appid: 'replace-with-douyin-app-id' },
        xhs: { ...common, appid: 'replace-with-xhs-app-id' },
        jd: { ...common, appid: 'replace-with-jd-app-id' },
        swan: { ...common, appid: 'replace-with-swan-app-id' },
      },
    },
  },
})
```

```text
src/
  app.json
  ...
vite.config.ts
.env.production.local
```

不写 `targets` 时从 `projectConfigs` 的平台键推导允许列表；只发布两端就只保留对应两项。公共对象展开是普通 JavaScript，平台字段覆盖前面的公共字段，不引入额外的深合并规则。多环境 AppID 从 `.env.test` / `.env.production` 读取，完整示例见[环境与自动版本](./upload/environments.md#appid)。

构建器在代码输出目录内生成平台标准 JSON，与 `app.json` 放在一起：

| 对象 | 默认路径 |
| --- | --- |
| 小红书生成项目配置 | `dist/xhs/dist/project.config.json` |
| 小红书代码产物 | `dist/xhs/dist/app.json` |
| 百度生成项目配置 | `dist/swan/dist/project.swan.json` |
| 百度代码产物 | `dist/swan/dist/app.json` |

生成 JSON 的代码根为 `.`（百度使用 `smartProgramRoot`，其余为 `miniprogramRoot`）。**不要在 `projectConfigs` 填写代码根字段，也不要修改生成 JSON**；自定义输出使用 `build.outDir`，上传和预览跟随本次实际写出的目录。Token、私钥等仍放环境变量，不能放进 `projectConfigs`。

已有原生文件项目仍可使用 `multiPlatform: { projectConfigRoot: 'config', targets: ['xhs', 'tt'] }`，分别读取 `config/<平台>/` 下的原生 JSON。两种来源不能混用；统一配置缺少选中平台时直接报错，不回退到旧文件。启用多平台模式后不使用 `--project-config`。原生文件模式的 SDK 代码根仍须与实际输出一致，详见[多平台配置](./multi-platform.md)。

```bash
# 单次构建上传一个平台；要求明确 -p
pnpm exec wv build --upload -p xhs

# 按给定顺序分别构建、校验、上传；未选平台不会执行
pnpm exec wv upload -p xhs,tt --uv 1.2.3 --desc "同步发布开发版本"

# 仅检查六个平台的配置和构建输出
pnpm exec wv upload -p all --dry-run

# 确认六套配置和凭据都齐备后，才执行真实六端上传
pnpm exec wv upload -p all

# 也可以批量生成预览
pnpm exec wv preview -p xhs,tt
```

**两个 `all` 含义不同**：`upload -p all` / `preview -p all` 是六个小程序平台；`build -p all --upload` 仍是现有的“小程序 + Web”，等两个构建后端都成功后只上传小程序，不代表六端。`build` 不接受 `-p xhs,tt`，多个小程序目标使用独立 `upload` / `preview` 入口。

批量操作串行执行，重复平台去重；`all` 顺序为微信、支付宝、抖音、小红书、京东、百度。首次失败即停止，已经上传的平台不会回滚。`multiPlatform.targets` 是允许列表，不会自动把 `all` 缩减成该列表；仅配置部分平台时显式传 `-p xhs,tt`。解决失败后只重试未完成的平台，不要误以为整批原子提交。取消命令会停止上传子进程，但不能撤回平台已经接收的版本。

## 5. CI：明确授权后上传 {#ci}

以下为业务项目 GitHub Actions 的**步骤片段**，不是本仓库的自动发布配置。放在检出代码、安装 Node/pnpm、`pnpm install --frozen-lockfile` 和项目检查通过之后；官方 SDK 必须已保存为项目依赖。由人工触发或受保护发布环境执行，不使用来自不可信 PR 的参数或 Secrets。

Token 型平台，以小红书为例：

```yaml
- name: 构建并上传小红书开发版本
  env:
    XHS_UPLOAD_TOKEN: ${{ secrets.XHS_UPLOAD_TOKEN }}
  run: pnpm exec wv build --upload -p xhs --uv 1.2.3 --desc "CI 验证后的更新"
```

抖音改用 `TT_UPLOAD_TOKEN` 和 `-p tt`；百度同时配置 `SWAN_UPLOAD_TOKEN`、`SWAN_MIN_VERSION` 并使用 `-p swan`；京东将密钥完整内容注入 `JD_PRIVATE_KEY` 并使用 `-p jd`。AppID 默认仍来自源码项目配置，不应因为切换 CI 平台而使用别的应用 ID。

文件型凭据，以微信为例：在 GitHub Secrets 中保存完整上传密钥为 `WEAPP_CI_PRIVATE_KEY`，使用 Node 写入 runner 临时目录，避免 shell quoting 破坏多行内容。这个 Secret 名是示例 workflow 自己选择的，CLI 实际读取的是输出的 `WEAPP_CI_PRIVATE_KEY_PATH`。

```yaml
- name: 提供微信上传密钥文件
  shell: bash
  env:
    UPLOAD_KEY_CONTENT: ${{ secrets.WEAPP_CI_PRIVATE_KEY }}
  run: |
    node --input-type=module <<'NODE'
    import { appendFileSync, writeFileSync } from 'node:fs'
    import path from 'node:path'
    const keyPath = path.join(process.env.RUNNER_TEMP, 'weapp-upload.key')
    writeFileSync(keyPath, process.env.UPLOAD_KEY_CONTENT, { mode: 0o600 })
    appendFileSync(process.env.GITHUB_ENV, `WEAPP_CI_PRIVATE_KEY_PATH=${keyPath}\n`)
    NODE
- name: 构建并上传微信开发版本
  run: pnpm exec wv build --upload -p weapp --uv 1.2.3 --desc "CI 验证后的更新"
- name: 清理微信上传密钥
  if: always()
  shell: bash
  run: |
    node --input-type=module <<'NODE'
    import { rmSync } from 'node:fs'
    import path from 'node:path'
    rmSync(path.join(process.env.RUNNER_TEMP, 'weapp-upload.key'), { force: true })
    NODE
```

该文件示例使用 `bash` shell，适用于带 bash 的 runner；文件创建与删除由 Node 完成。支付宝可使用相同方式写入官方 JSON 身份文件，并将路径导出为 `ALIPAY_IDENTITY_KEY_PATH`，不能把普通 PEM 应用私钥改个扩展名代替它。微信还要将 runner 的出口 IP 加入平台白名单；共享托管 runner 的 IP 策略需按平台要求安排。

建议让同一应用的上传任务串行，例如 workflow 的 job 级 `concurrency` 使用稳定的应用分组并设置 `cancel-in-progress: false`。京东上传和预览还必须避免共享系统临时目录的其他进程并发。抖音 SDK 可能在本地持久化 Token；百度 SDK 使用子进程 `--token` 参数传递 BDUSS，同机有权限的用户可能读取。使用可信、隔离、任务结束后销毁的 runner，日志脱敏不是第三方 SDK 安全沙箱。

## 6. 常见失败与处理 {#troubleshooting}

| 现象                                             | 检查与处理                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 找不到官方工具包                                 | 在执行命令的业务项目安装目标 SDK；全局安装或仓库其他 app 的依赖不能代替本项目依赖                       |
| 缺少 Token、私钥路径或最低基础库变量             | 核对平台变量名、`--mode`、`root` / `envDir`；进程环境会覆盖环境文件，包括已有空值                       |
| 密钥文件无法读取                                 | 相对路径以命令源码根为基准；检查文件存在和访问权限，不是以 `.env` 所在目录为基准                        |
| 支付宝 JSON 身份文件缺少 `alipay.authentication` | 重新从官方身份密钥流程取得文件，不使用业务应用 PEM/RSA 私钥、不自行拼装                                 |
| AppID 不匹配                                     | 修改源码目标项目配置；抖音、小红书可选环境 ID 必须与产物的 `appid` 一致，百度也校验小写 `appid`         |
| 版本或说明被拒绝                                 | 推荐 `1.2.3`；支付宝禁前导零且说明少于 200 字符，抖音三段数字，百度二至四段数字；平台还可能拒绝重复版本 |
| 代码目录不一致 / 缺少 `app.json`                 | SDK 实际根目录必须等于本次输出；检查项目标准文件名、代码根字段、`--outDir` 和多平台布局，不要指向旧包   |
| 开启多平台后提示必须指定平台                     | 显式传 `-p xhs` 等；`targets` 不会自动选择当前平台                                                      |
| `--version 1.2.3` 没有上传                       | `--version` / `-v` 是 CLI 版本查询；新上传入口使用 `--uv`                                               |
| 预览没有二维码文件                               | 只有微信写本地图片；其他目标返回二维码 URL 或扫码链接；dry-run 不生成任何预览结果                       |
| SDK 异常退出或未收到完成确认                     | 本次视为失败；检查脱敏错误、平台权限和网络，不要仅凭子进程 exit 0 判断上传成功                          |
| dry-run 成功，真实上传失败                       | dry-run 未校验凭据及官方平台规则，不代表授权、白名单、网络或平台受理成功                                |
| 上传成功，用户看不到正式版本                     | 这里只上传开发版本；还需要在对应平台完成测试、提审与正式发布流程                                        |
| `-p taobao` 无法使用                             | 当前没有淘宝构建/上传适配；不能换成 `-p alipay` 冒充淘宝，见[支持边界](./upload/alipay.md#taobao)       |

真实上传需要有效凭据、平台授权与网络；构建成功、dry-run、平台受理、IDE 编译和真机 Runtime 是不同验收层。最终应使用目标平台的 IDE/真机检查业务功能。完整参数列表见 [CLI 命令参考](./cli.md)。
