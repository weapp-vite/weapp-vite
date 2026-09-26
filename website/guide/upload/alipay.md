---
title: 支付宝小程序上传与预览（含淘宝边界）
description: 配置支付宝 minidev JSON 身份密钥、AppID 和构建目录，上传开发版本并生成预览二维码；明确淘宝不在 weapp-vite 统一上传支持范围内。
keywords:
  - weapp-vite
  - 支付宝小程序
  - minidev
  - 淘宝小程序
  - 上传
  - 预览
---

# 支付宝小程序上传与预览

本页面向 `alipay` 目标，调用官方 `minidev` 的支付宝上传/预览接口。**淘宝不是支付宝目标的别名**；如果你要上传淘宝小程序，请先看[淘宝支持边界](#taobao)。

以下从已经能运行的原生小程序开始，源码位于 `src/`，有完整应用入口、页面和应用配置。已有框架项目应保留插件和编译配置，只合并本页所需字段；组件库、独立插件与空目录不适用。环境准备见[开始使用](../upload.md#setup)。

`test` / `production`、不同 AppID 与自动版本/提交说明见[多环境上传](./environments.md)。

## 1. 在应用中安装工具

在应用 `package.json` 所在目录局部安装：

```sh
pnpm add -D weapp-vite minidev
```

后续命令都在这个**源码项目根目录**执行，不进入 `dist/`。只全局安装 `minidev` 不足以供统一入口解析。官方工具安装时可能下载编译、调试相关资源，请保持安装阶段网络可用。

## 2. 配置构建与支付宝项目

项目根目录的完整 `vite.config.ts`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'alipay',
    srcRoot: 'src',
  },
})
```

无需配置 `weapp.upload`：上传版本默认读取业务 `package.json.version`，说明按包名与最终版本自动生成 `name@version`；版本不会自动递增。仅需固定覆盖时才设置 `weapp.upload`，临时覆盖可用下文 CLI 参数。

上传默认值只由 `build --upload` / `upload` 消费，不会让普通 `build`、`dev` 或 HMR 自动上传。配置文件代码仍正常求值，不要在配置里调用有外部副作用的上传逻辑。

在项目根目录创建或修改**源码侧** `mini.project.json`，保留已有 IDE 配置。本例所需字段如下；`replace-with-alipay-appid` 是占位值，请换成自己的支付宝小程序 AppID：

```json
{
  "appid": "replace-with-alipay-appid",
  "format": 2,
  "compileType": "mini",
  "miniprogramRoot": "dist",
  "compileOptions": {
    "typescript": false
  }
}
```

这里交给 minidev 的是已经由 `weapp-vite` 生成的代码，示例不再让 minidev 编译 TypeScript。没有启用 `multiPlatform`、没有自定义 `build.outDir` 时，目录关系如下：

| 用途                             | 路径                |
| -------------------------------- | ------------------- |
| 编译源码                         | `src/`              |
| 支付宝项目配置                   | `mini.project.json` |
| minidev 的项目目录               | 项目根目录 `.`      |
| `miniprogramRoot` 指向的代码目录 | `dist/`             |
| 本次构建的应用配置               | `dist/app.json`     |

`mini.project.json` 是标准文件名，不能改用微信的 `project.config.json`。也不要把 `miniprogramRoot` 改成 `src` 或仅配置 `srcMiniprogramRoot`；上传前会校验 SDK 读取的目录是否等于本次构建输出。

## 3. 获取官方 JSON 身份密钥

本入口需要的是 **minidev 开发工具 JSON 身份密钥文件**，不是业务签名用的 PEM/RSA 应用私钥文件，也不是 AppSecret。即使 JSON 内含 `privateKey`，也应保存官方文件整体，不能只取其中的 PEM 字符串。

按[支付宝官方授权文档](https://opendocs.alipay.com/mini/02q29w)获取：

1. 登录[支付宝开放平台](https://open.alipay.com/platform/developerIndex.htm)。
2. 进入“账户中心 → 密钥管理 → 开发工具密钥 → 生成身份密钥”，下载官方身份密钥文件。
3. 将文件原样保存为项目根目录的 `.keys/alipay-identity.json`，保持为有效 JSON。
4. 确认文件包含 `alipay.authentication`，并使用对目标小程序有权限的账号获取。

不要自行拼装一个带占位值的 JSON 来代替平台身份文件。此入口会检查文件是否可读、是否为 JSON，以及是否包含 `alipay.authentication`。

> [!WARNING]
> 官方文档说明，同一支付宝用户同时只有一份开发工具密钥有效。在另一台机器上执行 `minidev login` 或重新生成身份密钥，可能使之前的密钥失效。CI 应通过安全文件或 Secrets 管理同一份有效文件及其轮换，不要让每个 runner 重复登录生成密钥。

本入口显式要求 `ALIPAY_IDENTITY_KEY_PATH`，不会因为电脑上曾经 `minidev login` 就省略此配置。

在项目根目录创建 `.env.production.local`：

```dotenv
ALIPAY_IDENTITY_KEY_PATH=.keys/alipay-identity.json
```

AppID 默认来自 `mini.project.json`；如需覆盖，可设置 `ALIPAY_APP_ID`，但必须对应密钥账号有权操作的支付宝小程序。密钥相对路径始终以命令的源码项目根目录为基准，不相对于 `.env`、Vite `root` 或构建目录。

在 `.gitignore` 中加入：

```text
.env.local
.env.*.local
.keys/
```

不要把 `.keys/` 放到 `src/`、静态资源或平台配置目录中，也不要为凭据加 `VITE_` 前缀或写入 `weapp.upload`。默认 mode 是 `production`；`--mode test` 使用 `.env.test.local` 等文件。进程环境优先，更多见[环境与凭据](../upload.md#environment)。

## 4. dry-run 与开发版本上传

先只构建、检查项目配置及产物目录：

```sh
pnpm exec wv build --upload -p alipay --dry-run
```

dry-run 不加载 minidev、不检查身份密钥、不验证远端权限，也不会证明官方接受了这个版本。

确认 AppID、身份文件和版本后，再明确执行真实上传：

```sh
pnpm exec wv build --upload -p alipay
```

本命令使用业务包版本和自动生成的说明。需要一次性覆盖时，可用独立入口自行构建后上传：

```sh
pnpm exec wv upload -p alipay --uv 1.2.4 --desc "修复首页展示"
```

两种入口二选一，不需要先单独构建再调用 `upload`。版本取值顺序为 `--uv` → `weapp.upload.version` → `package.json.version`；`-v` / `--version` 只查询 CLI 版本。

支付宝上传有以下严格限制：

- 版本必须恰好为三段非负整数，如 `0.0.1`、`1.2.3`。
- 各段不得有前导零；`01.2.3` 不合法，但单独的 `0` 合法。
- 每段不得超过 `2147483647`；不能使用 `1.2.3-beta.1` 等预发布后缀。
- 上传说明必须**少于 200 个字符**；显式空说明会使用自动生成说明，自动说明也须满足限制。

成功时 CLI 报告开发版本上传完成。适配器固定 `clientType: 'alipay'`、`experience: false`：**不自动设为体验版，不提审，不正式发布**。官方 minidev 自身还有其他选项，但不能直接当作统一 `wv upload` 的参数使用。

## 5. 构建并生成预览二维码

```sh
pnpm exec wv preview -p alipay --dry-run
pnpm exec wv preview -p alipay
```

第一条只做构建与目录检查；第二条重新构建并调用 `minidev.preview`，仍需同一份 JSON 身份文件和 AppID。返回的是**官方二维码图片 URL**，CLI 以“二维码图片”打印；打开该图片，用有权限的支付宝账号扫码。

它不是本地图片路径，不自动打开浏览器、不修改剪贴板，也不调用开发版本上传。预览不使用 `weapp.upload` 的默认值，不需要版本号，**不能传 `--uv`**。二维码有效期、扫码权限及实际真机运行以支付宝规则为准；未返回有效二维码地址时会报失败。

## 6. 改成 multiPlatform 项目

推荐将 `weapp.multiPlatform` 设为 `{ projectConfigs: { alipay: { appid: 'replace-with-alipay-appid' } } }`，其他平台放入同一映射。公共字段用对象展开复用，不需要新增 `config/alipay/mini.project.json`；完整配置与 test/production 见[统一配置](../upload.md#batch)和[环境指南](./environments.md#appid)。

默认生成 `dist/alipay/dist/mini.project.json`，与 `app.json` 同级；minidev 项目目录为 `dist/alipay/dist`，生成代码根为 `.`。输入不指定代码根，自定义目录使用 `build.outDir`。密钥、环境文件仍在源码项目根，不放进映射，不修改生成 JSON。

原生文件方式仍可使用 `{ projectConfigRoot: 'config', targets: ['alipay'] }`：配置放在 `config/alipay/mini.project.json`，代码根为 `dist`，minidev 项目目录为 `dist/alipay`，代码在 `dist/alipay/dist`。不能与 `projectConfigs` 同时使用。命令仍显式传 `-p alipay`，CI 密钥方案见[总览](../upload.md#ci)。

## 淘宝：当前统一入口不支持 {#taobao}

`weapp-vite` 当前的小程序目标是 `weapp`、`alipay`、`tt`、`xhs`、`jd`、`swan`，**没有淘宝 adapter**。因此：

- 不存在可用的 `-p taobao` 构建、上传或预览目标。
- 支付宝上传/预览固定使用 `clientType: 'alipay'`，统一命令不提供切换成淘宝的 `--clientType taobao` 参数。
- 换一个淘宝 AppID、修改 JSON 字段、复用 minidev 名称或把 AXML 产物交给淘宝，不会让此功能获得淘宝支持。
- 本页的支付宝密钥、项目配置、上传命令和成功结果，不能作为淘宝上传成功或产物兼容的证据。

淘宝项目请从[淘宝小程序官方入口](https://miniapp.open.taobao.com/)进入其[开发者工具说明](https://miniapp.open.taobao.com/docV3.htm?docId=117317&docType=1)，按照淘宝自己的工具链、应用权限、项目配置与上传/预览流程操作。此链接是独立的官方工具链入口，**不表示 `weapp-vite` 的支付宝产物已与其互通**；本页不提供未经支持的淘宝命令。

## 常见问题

| 现象                                             | 检查方向                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| 无法解析 `minidev`                               | 在消费 `weapp-vite` 的应用中局部安装，不能仅靠全局命令                  |
| 身份密钥不是 JSON / 缺少 `alipay.authentication` | 重新取得官方开发工具身份文件，不要传 PEM 文件或手工拼装 JSON            |
| 之前可上传，现在鉴权失败                         | 检查是否在其他机器重新登录或重置过工具密钥，检查目标 AppID 权限         |
| 版本或说明校验失败                               | 按三段数字、无前导零、每段上限和说明小于 200 字符检查最终值             |
| `mini.project.json` 代码目录不一致               | 核对 `miniprogramRoot` 与 `build.outDir`，修改源码配置后重新构建        |
| dry-run 成功但正式调用失败                       | dry-run 不检查凭据、远端权限或官方编译结果，继续查看 minidev 的实际错误 |
| 想上传淘宝                                       | 先阅读[淘宝边界](#taobao)，不要改用虚假的平台名或客户端参数             |

更多见[统一命令区别](../upload.md#commands)和[通用排错](../upload.md#troubleshooting)。官方接口资料可参考 [minidev 上传](https://opendocs.alipay.com/mini/02q3an)与[预览](https://opendocs.alipay.com/mini/02q3al)；本页只描述 `weapp-vite` 已接入的参数与行为。
