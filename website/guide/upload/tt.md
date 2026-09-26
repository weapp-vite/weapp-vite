---
title: 抖音小程序上传与预览
description: 从可运行的抖音小程序开始，配置 weapp-vite、project.config.json 与 TT_UPLOAD_TOKEN，使用 tt-ide-cli 完成开发版本上传、预览链接生成及隔离 CI 凭据管理。
keywords:
  - 抖音小程序
  - upload
  - preview
  - tt-ide-cli
  - TT_UPLOAD_TOKEN
---

# 抖音小程序上传与预览

本页以**已经安装 `weapp-vite`、能构建并在抖音开发者工具中运行的完整小程序**为起点，目标平台标识是 **`tt`**。原生项目与已接入的框架项目共用本流程；框架项目需保留已有编译插件和业务配置。尚未接入时先看[准备项目](../upload.md#setup)。组件库、独立插件不在本入口范围内。

所有命令在源码项目根目录执行，`wv` 与 `weapp-vite` 等价。这里上传的是开发版本，**不自动提审、不正式上线**；官方工具的其他提审、发布能力不会被本入口调用。

`test` / `production`、不同 AppID 与自动版本/提交说明见[多环境上传](./environments.md)。

## 1. 配置源码项目 {#config}

以 `src/` 为源码目录的最小完整 `vite.config.ts`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'tt',
    srcRoot: 'src',
  },
})
```

将这些字段合并到已有框架配置时，不要删除应用正常构建所需的插件。无需配置 `weapp.upload`：上传版本默认读取业务 `package.json.version`，说明按包名与最终版本自动生成 `name@version`；版本不会自动递增。仅需固定覆盖时才设置 `weapp.upload`，临时覆盖可用下文 CLI 参数。

普通 `wv build`、`wv dev` 和 HMR 不上传，`production` mode 本身也不会开启上传。配置文件 JavaScript 仍正常求值，不要在配置求值时执行上传等副作用，也不要把 Token 写进 `weapp.upload`。

在源码根目录的 **`project.config.json`** 中设置这些字段，保留应用其他已有抖音配置。`replace-with-douyin-app-id` 是占位值，必须替换为自己的抖音小程序 AppID：

```json
{
  "appid": "replace-with-douyin-app-id",
  "compileType": "miniprogram",
  "miniprogramRoot": "dist/"
}
```

本例的根目录映射如下：

```text
项目根目录/
├─ vite.config.ts
├─ package.json
├─ project.config.json         # 官方工具读取的项目配置
├─ .env.production.local       # 本地凭据，不提交
├─ src/                        # 已能运行的小程序源码
└─ dist/                       # 本次构建生成的代码
   └─ app.json
```

- 必须使用小写 **`appid`**，仅写 `appId` 不满足抖音适配器检查。
- `weapp.srcRoot` 指源码；`miniprogramRoot` 指产物，不要把后者写成 `src/`。
- 没有额外覆盖 `build.outDir` 时，本例构建到 `dist/`。SDK 接收根目录 `.`，再读取该目录 `project.config.json` 的 `miniprogramRoot`，最终使用 `dist/app.json`。
- 上传前会检查 SDK 代码根目录与本次构建输出一致。若已有项目自定义输出目录，必须让两边指向同一目录；不要手工改生成物或让 SDK 读取另一次构建的产物。

## 2. 安装官方工具并取得 Token {#credentials}

将抖音官方工具安装到**使用 `weapp-vite` 的应用项目**，不是仅安装全局 `tma`：

```sh
pnpm add -D tt-ide-cli
```

`weapp-vite` 从当前应用动态加载 `tt-ide-cli` 的 SDK。官方文档说明免密 Token 从 `tt-ide-cli@0.1.22` 开始支持；旧项目应更新依赖并提交锁文件。官方 README 中的 `tma` 参数不等于 `wv` 参数，本页统一使用 `wv`，无需另外调用 `tma set-app-config`。

### Token 的来源与用途

按[抖音官方「CLI 免密登录」文档](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/dev-tools/developer-instrument/development-assistance/cli-token)，由具有相应权限的目标小程序管理员操作：

1. 进入**小程序控制台 → 开发 → 开发配置**，点击**立即启用**。
2. 通过验证码验证，生成该小程序的 Token。
3. 立即复制并安全保存。官方文档说明生成后无法再次查看，丢失时需重置；重置后同步更新本地凭据与 CI Secrets。

[`tt-ide-cli` 官方包 README](https://unpkg.com/tt-ide-cli@0.1.33/README.md) 也说明 Token 按 AppID 设置，**用于替代登录态**。本入口会自动调用官方 SDK 设置 Token，不需要照搬官方文档中的全局安装或手工 `tma set-app-config` 步骤。

这是官方 CLI / CI 使用的 Token，**不是业务开放接口的 `access_token`、AppSecret、账号密码或 Token 文件路径**。若账号看不到文档所述入口，核对应用与管理权限，以平台当前界面为准。未取得 Token 时只能先做 dry-run，不能完成真实上传或预览。

本入口不隐式登录、不调用手机/邮箱登录，也不会提示扫码认证。即使本机官方 IDE 或 `tma` 已登录，`TT_UPLOAD_TOKEN` 仍是必填项。预览时体验者使用的扫码入口不属于开发者登录认证。

### 保存环境文件

默认在源码项目根目录创建 `.env.production.local`。以下值**都是占位值**，必须换成实际 Token 与 AppID：

```dotenv
TT_UPLOAD_TOKEN=replace-with-douyin-upload-token

# 可选；省略时读取 project.config.json 的 appid
# 如设置，必须与 project.config.json 中的 appid 完全一致
TT_APP_ID=replace-with-douyin-app-id
```

`TT_APP_ID` 不能用来临时切换到其他应用。项目配置仍必须有 `appid`；设置环境变量后，适配器会检查它与 SDK 读取的 `project.config.json` 中的值完全相同。

将以下规则加入 `.gitignore`，环境文件不要放在 `src/`、静态资源目录或构建产物中：

```text
.env.local
.env.*.local
```

默认 mode 是 `production`，依次加载 `.env` → `.env.local` → `.env.production` → `.env.production.local`，后者覆盖前者；已有进程环境变量优先级最高。`--mode test` 改用 `.env.test` / `.env.test.local`，但仍执行生产构建。使用自定义 Vite `root`、`envDir` 或 `envDir: false` 时，按[环境与凭据规则](../upload.md#environment)确认读取位置。不要添加 `VITE_` 前缀，也不要在命令行中展开 Token。

> [!WARNING]
> 抖音官方 SDK 的 `setAppConfig` 会把 Token 写入它自己的本地配置，**不仅存在于本次进程内存中**；上传和预览都受影响。只删除 `.env.production.local` 或结束子进程，不等于清除 SDK 已保存的 Token。请在可信开发环境或可信、隔离的一次性 CI runner 中运行，任务结束后销毁 runner 环境及其凭据存储；不要把用户目录、SDK 配置或相关缓存保存成公共缓存、构建产物，也不要在不可信共享主机上执行。`weapp-vite` 的进程隔离不是第三方 SDK 的安全沙箱。

## 3. 先检查构建与目录 {#dry-run}

```sh
pnpm exec wv build --upload -p tt --dry-run
```

成功时出现 `[upload:tt] dry-run` 提示。这一步只进行本次生产构建、SDK 代码根目录与本次输出的一致性检查，并确认 `app.json` 存在。

**dry-run 不校验上传凭据、不加载官方上传 SDK、不调用远端服务**，没有安装 `tt-ide-cli`、没有 Token 也能先做这项检查。上传入口仍要求非空版本。它不能证明 Token 有效、平台接受该版本、账号具备上传权限或应用能在真机正常运行；平台专属版本与认证检查也不能用它替代。

需要检查预览路径时：

```sh
pnpm exec wv preview -p tt --dry-run
```

这也只检查构建与产物，不生成二维码或预览链接。

## 4. 显式上传开发版本 {#upload}

确认配置中是真实 AppID、已注入有效 Token，并使用可信运行环境后执行：

```sh
pnpm exec wv build --upload -p tt
```

它在本次构建和目录校验通过后调用抖音上传接口，默认使用业务包版本和自动生成的说明。成功会报告该版本上传完成（未提审、未正式发布）。随后在目标小程序的平台版本管理中确认开发版本，提审和正式发布仍需另走平台流程。

临时覆盖版本和说明：

```sh
pnpm exec wv build --upload -p tt --uv 1.2.4 --desc "修复首页展示"
```

独立 `upload` 是另一种选择，**自行构建后上传**，不复用旧产物，也不需要先串联 `wv build`：

```sh
pnpm exec wv upload -p tt --uv 1.2.4 --desc "修复首页展示"
```

两种方式二选一，不要为了同一个版本重复执行。

### 版本与参数限制

- 抖音适配器要求上传版本严格为三段数字 **`x.y.z`**，例如 `1.2.3`；`1.2`、`v1.2.3`、`1.2.3-beta.1` 都不满足本地校验。
- 版本优先级是 `--uv` > `weapp.upload.version` > `package.json.version`。若包版本带预发布后缀，显式配置 `weapp.upload.version` 或传 `--uv`。
- 最终说明不能为空。优先级为 `--desc` > `weapp.upload.desc` > 根据包名与最终版本生成的 `name@version`；空白说明使用生成值。
- `--version` / `-v` 查询的是 CLI 版本，不是抖音上传版本。官方 `tma` 的 `--app-version`、`--app-changelog` 也不是 `wv` 参数。
- `build` 上的 `--uv`、`--desc`、`--dry-run` 必须与 `--upload` 一起使用；上传不能与 `--watch` 组合。

抖音服务端仍可能根据应用权限、包内容及平台规则拒绝请求，本地校验不替代官方接受结果。完整命令与模式说明见[公共命令说明](../upload.md#commands)。

## 5. 独立生成预览链接 {#preview}

```sh
pnpm exec wv preview -p tt
```

它重新构建，使用同一组 AppID 和 Token 调用官方 `preview`，不调用开发版本上传、提审或发布接口。预览不消费 `weapp.upload` 的默认版本与说明，**不接收 `--uv`**，因此无需为预览提供上传版本。

成功结果是 **预览链接（preview link）**：官方 SDK 的 `shortUrl`，CLI 以 `[preview:tt] 预览链接：…` 输出。它是二维码承载的预览短链，**不是二维码图片 URL**。本入口不生成本地二维码图片、不自动打开浏览器，也不修改剪贴板；不要把该链接当作图片地址使用。

官方 `tma preview` 自身的图片输出、启动页面等参数没有透传到 `wv preview`，不要直接照搬 `--qrcode-output`、`--miniapp-path` 等参数。链接的有效期、扫码者权限和可用宿主以抖音规则为准；收到有效链接后仍需目标设备验证。只完成 dry-run 不会获得任何远端预览结果。

## 6. 已启用 multiPlatform 的项目 {#multi-platform}

多目标应用继续保留自己的 `targets` 与编译配置，无需添加 `weapp.upload`；仅演示抖音目标时的完整配置如下：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'tt',
    srcRoot: 'src',
    multiPlatform: {
      enabled: true,
      targets: ['tt'],
    },
  },
})
```

将第 1 节的项目配置放到 `config/tt/project.config.json`，仍保留 `"miniprogramRoot": "dist/"`。默认映射是：

| 内容                    | 路径                            |
| ----------------------- | ------------------------------- |
| 需要编辑的源码配置      | `config/tt/project.config.json` |
| 构建后复制的项目配置    | `dist/tt/project.config.json`   |
| 官方 SDK 接收的项目目录 | `dist/tt`                       |
| 本次小程序代码          | `dist/tt/dist`                  |

构建器将 `config/tt/` 内容复制到代码产物的父目录 `dist/tt/`；生成项目配置中的 `dist/` 因而定位到 `dist/tt/dist/`。不要在源配置的 `miniprogramRoot` 中再写一遍 `dist/tt/dist/`，不要手改生成配置。自定义路径时，应按 SDK 的项目根目录重新核对映射，而不是假设所有输出布局都会被自动改写。

凭据仍位于源码项目根目录的 `.env.production.local`，不要放进会被复制的 `config/tt/`。启用 `multiPlatform` 后必须传 `-p tt`，不再支持 `--project-config`；本页其他命令保持不变。多平台队列及失败停止行为见[批量任务](../upload.md#batch)，可信发布任务的 Secrets 注入见[CI 上传](../upload.md#ci)，并务必遵守本页的 SDK 本地存储限制。

## 7. 抖音常见错误 {#troubleshooting}

| 现象                                                 | 检查与处理                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `无法解析上传工具 tt-ide-cli`                        | 在应用项目中安装 `pnpm add -D tt-ide-cli`；CI 不能省略该开发依赖。全局 `tma` 安装不能替代项目依赖。                                 |
| `上传缺少环境变量 TT_UPLOAD_TOKEN`                   | 检查 mode、环境目录和 CI Secrets 是否注入；官方 IDE 已登录不能代替这个变量，不要填业务 `access_token` 或文件路径。                  |
| `抖音上传版本号必须为 x.y.z 格式`                    | 检查最终版本来源。常见原因是继承了 `package.json` 的预发布版本；使用 `--uv 1.2.3` 或修改上传默认值，不要传 `-v`。                   |
| `project.config.json 的 appid 必须与 TT_APP_ID…一致` | 确认源码配置中是小写 `appid`，并清除过期的进程 `TT_APP_ID` 或将其改成相同值；多平台配置应修改 `config/tt/`。                        |
| SDK 报 Token 失效、无权限或需要登录                  | 核对目标应用、Token 有效性与上传授权，更新受保护的凭据来源；本入口不发起手机、邮箱或扫码登录，不应依赖共享 runner 遗留的登录态。    |
| SDK 写入本地配置失败                                 | 抖音 SDK 会持久化 Token，运行账号需有其配置目录的写权限。使用可信且可写的隔离环境；不要为解决权限错误切换到不可信共享账号。         |
| `代码目录与本次构建输出不一致` / 缺少 `app.json`     | 对照根目录映射检查 `miniprogramRoot`、`build.outDir` 和完整小程序入口。`srcMiniprogramRoot` 不能代替 SDK 所需的 `miniprogramRoot`。 |
| `抖音预览未返回有效的预览链接`                       | 官方 SDK 未返回有效 `shortUrl`；检查工具版本、远端权限和官方响应，不要把上传成功或旧二维码当作本次预览成功。                        |

其他构建、环境与网络问题见[公共排障](../upload.md#troubleshooting)。小红书使用另一套工具和 Token，且不具有相同的本地版本格式校验；详见[小红书上传与预览](./xhs.md)。
