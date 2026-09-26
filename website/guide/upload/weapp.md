---
title: 微信小程序上传与预览
description: 从完整的 weapp-vite 配置开始，配置微信 AppID、代码上传密钥、IP 白名单与 CI 机器人，构建上传开发版本并生成本地预览二维码。
keywords:
  - weapp-vite
  - 微信小程序
  - miniprogram-ci
  - 上传
  - 预览
---

# 微信小程序上传与预览

本页使用 `weapp` 目标和官方 `miniprogram-ci`。从一个已经能运行的完整小程序开始：源码在 `src/`，包含应用入口、页面和应用配置；不是组件库、独立插件或只有 `vite.config.ts` 的空目录。新项目准备见[开始使用](../upload.md#setup)。

以下以原生小程序为例。已有框架项目应保留其插件、入口和编译配置，只合并平台和源码目录，不要直接覆盖整个配置。

`test` / `production`、不同 AppID 与自动版本/提交说明见[多环境上传](./environments.md)。

## 1. 在应用中安装工具

在消费 `weapp-vite` 的**小程序项目根目录**执行，不能只全局安装或装在无关工作区：

```sh
pnpm add -D weapp-vite miniprogram-ci
```

此目录应有应用的 `package.json`。后续所有命令都在这里执行，不进入 `dist/`。统一入口不要求先打开或登录微信开发者工具，但需要有效的上传密钥和平台权限。

## 2. 配置构建与微信项目

项目根目录的完整 `vite.config.ts`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'weapp',
    srcRoot: 'src',
  },
})
```

无需配置 `weapp.upload`：上传版本默认读取业务 `package.json.version`，说明按包名与最终版本自动生成 `name@version`；版本不会自动递增。仅需固定覆盖时才设置 `weapp.upload`，临时覆盖可用下文 CLI 参数。

`weapp.upload` 不是自动上传开关。普通 `wv build`、`wv dev` 和 HMR 不上传；配置文件本身仍正常求值，不要在配置代码中执行上传副作用。

在**源码项目根目录**创建或修改 `project.config.json`，保留已有 IDE 配置。下面展示本例所需字段，`replace-with-wechat-appid` 是占位值，必须替换为自己的微信 AppID：

```json
{
  "appid": "replace-with-wechat-appid",
  "compileType": "miniprogram",
  "miniprogramRoot": "dist"
}
```

本例没有启用 `multiPlatform`，也没有自定义 `build.outDir`，对应关系是：

| 用途                                    | 路径                  |
| --------------------------------------- | --------------------- |
| 编译源码                                | `src/`                |
| 微信项目配置                            | `project.config.json` |
| 官方 SDK 的项目目录                     | 项目根目录 `.`        |
| SDK 按 `miniprogramRoot` 读取的代码目录 | `dist/`               |
| 本次构建必须生成的应用配置              | `dist/app.json`       |

不要把 `miniprogramRoot` 写成 `src`，也不要用 `srcMiniprogramRoot` 代替它。上传前会核对 SDK 读取的目录是否就是本次构建输出；如果自行设置 `build.outDir`，必须同步调整源码侧项目配置。

## 3. 获取代码上传密钥并保存凭据

按[微信官方 CI 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)操作：

1. 使用有权限的账号登录目标小程序的[微信公众平台](https://mp.weixin.qq.com/)。
2. 在“管理 → 开发管理 → 开发设置 → 小程序代码上传”生成并下载**代码上传密钥**。
3. 配置上传机器的 IP 白名单；建议保持白名单开启，使用 CI 时应将 runner 的实际出口 IP 纳入白名单。
4. 将下载的密钥原样保存为项目根目录的 `.keys/weapp-upload.key`，不要放进 `src/`、静态资源目录或平台配置目录。

这是具有代码上传、预览权限的密钥，**不是 AppSecret**。不能将 AppSecret、业务 access token 或密钥文件路径当作私钥内容互换使用。

在项目根目录创建 `.env.production.local`：

```dotenv
WEAPP_CI_PRIVATE_KEY_PATH=.keys/weapp-upload.key
WEAPP_CI_ROBOT=1
```

- `WEAPP_CI_PRIVATE_KEY_PATH` 必填，必须指向非空文件。相对路径以命令的源码项目根目录为基准，不相对于 `.env`、Vite `root` 或 `dist/`。
- `WEAPP_CI_ROBOT` 可省略；设置时只能是 `1` 到 `30` 的整数。
- AppID 默认读取 `project.config.json`；可选 `WEAPP_CI_APPID` 会覆盖上传/预览使用的 AppID，必须与密钥授权的小程序对应。不要保留脚手架的 `touristappid`。

在 `.gitignore` 中加入：

```text
.env.local
.env.*.local
.keys/
```

上传、预览默认使用 `production` mode；使用 `--mode test` 时对应 `.env.test.local`。已存在的进程环境变量优先于文件配置，完整的 `root`、`envDir`、加载顺序见[环境与凭据](../upload.md#environment)。不要添加 `VITE_` 前缀，也不要把凭据写到 `weapp.upload` 或客户端代码中。

## 4. 先 dry-run，再显式上传

先只构建并检查目录：

```sh
pnpm exec wv build --upload -p weapp --dry-run
```

此步骤会生成本次产物并检查代码根目录和 `app.json`，**不校验密钥、IP 白名单或机器人权限，不加载官方 SDK，不发起远端上传**。因此它可以在尚未配置凭据时执行，但成功不代表微信接受了版本。

确认凭据与白名单后，使用业务包版本和自动说明上传开发版本：

```sh
pnpm exec wv build --upload -p weapp
```

需要一次性覆盖版本和说明时，也可以单独调用构建上传入口：

```sh
pnpm exec wv upload -p weapp --uv 1.2.4 --desc "修复首页展示"
```

这两种方式二选一即可：`build --upload` 复用本次构建；`upload` 自己先构建，不必预先运行一次 `build`。版本优先级是 `--uv` → `weapp.upload.version` → `package.json.version`；`--version` / `-v` 是 CLI 自身版本查询，不能代替 `--uv`。

成功时 CLI 报告该版本上传完成。这里只上传**开发版本，不自动提审或正式发布**。微信适配器不额外限制为三段版本号，仍建议使用 `1.2.3` 这类清晰的版本；平台最终校验以官方 SDK 为准。

## 5. 构建并生成预览二维码

```sh
pnpm exec wv preview -p weapp --dry-run
pnpm exec wv preview -p weapp --desc "首页真机预览"
```

第一条不调用官方工具、不生成二维码；第二条重新构建并调用微信官方 preview 接口，使用同一份密钥、AppID、IP 白名单和机器人设置。

结果是**本地二维码图片文件**，位于 `.weapp-vite/preview/` 下每次任务独立的 `.png` 文件中。CLI 打印相对路径；打开图片后用有权限的微信账号扫码。它不会自动打开图片或修改剪贴板，也不会把预览变成开发版本上传。

`preview` 不读取 `weapp.upload` 的版本/说明默认值，不需要上传版本，也不接受 `--uv`。二维码有效期、扫码权限以及实际运行效果由微信决定，不能用 dry-run 或构建成功代替真机验证。

## 6. 改成 multiPlatform 项目

推荐将 `weapp.multiPlatform` 设为 `{ projectConfigs: { weapp: { appid: 'replace-with-wechat-appid' } } }`，其他平台加入同一映射，公共字段用对象展开复用。无需新增 `config/weapp/project.config.json`；完整多端与多环境配置见[统一配置](../upload.md#batch)和[环境指南](./environments.md#appid)。

默认由打包器生成 `dist/weapp/dist/project.config.json`，与 `app.json` 同级，SDK/IDE 项目目录为 `dist/weapp/dist`，代码根为 `.`。输入对象不填写代码根字段；自定义目录使用 `build.outDir`，不要手改生成 JSON。密钥和环境文件仍留在源码项目根的 `.keys/`、`.env.production.local`，不得写入映射或客户端。

原生文件方式仍可使用 `{ projectConfigRoot: 'config', targets: ['weapp'] }`：源码配置为 `config/weapp/project.config.json`，代码根仍为 `dist`，生成配置与 SDK 项目目录位于 `dist/weapp`，代码在其 `dist/` 子目录。不能与 `projectConfigs` 同时配置。

上传和预览命令保持不变，显式使用 `-p weapp`；自动化密钥文件注入见[CI](../upload.md#ci)。

## 常见问题

| 现象                            | 检查方向                                                                  |
| ------------------------------- | ------------------------------------------------------------------------- |
| 无法解析 `miniprogram-ci`       | 在命令所指向的应用项目中局部安装工具，而不是只全局安装                    |
| 私钥文件不可读或为空            | 核对源码项目根目录、文件权限、实际保存位置，确认不是 AppSecret            |
| 官方鉴权或 IP 校验失败          | 核对密钥所属 AppID、runner 出口 IP 和微信后台白名单；dry-run 不会检查这些 |
| `WEAPP_CI_ROBOT` 报错           | 使用 `1` 到 `30` 的整数，或删除该可选变量                                 |
| 代码目录不一致或缺少 `app.json` | 按上表核对 `miniprogramRoot`、`build.outDir` 和实际应用入口               |
| 没有二维码或扫码失败            | 确认执行的不是 dry-run；查看本次生成的图片，检查平台扫码权限与有效期      |

如果旧脚本使用 `wv upload --project ...` / `wv preview --project ...`，那是已登录微信 IDE 的旧用法，应迁移到显式 `wv ide upload` / `wv ide preview`，不能混用本页的 CI 参数。更多见[命令区别](../upload.md#commands)和[通用排错](../upload.md#troubleshooting)。
