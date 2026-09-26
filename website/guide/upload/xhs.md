---
title: 小红书小程序上传与预览
description: 从可运行的小红书小程序开始，配置 weapp-vite、project.config.json 与 XHS_UPLOAD_TOKEN，使用 xhs-mp-cli 完成构建检查、开发版本上传和预览链接生成。
keywords:
  - 小红书小程序
  - upload
  - preview
  - xhs-mp-cli
  - XHS_UPLOAD_TOKEN
---

# 小红书小程序上传与预览

本页以**已经安装 `weapp-vite`、能构建并在小红书开发者工具中运行的完整小程序**为起点，演示单目标 `xhs` 项目。原生项目与已接入的框架项目使用相同的上传入口；已有项目应保留原有编译插件和业务配置。尚未完成接入时，先看[准备项目](../upload.md#setup)。组件库、独立插件不在本入口范围内。

所有命令都在源码项目根目录执行，`wv` 也可以写成 `weapp-vite`。上传只产生开发版本，**不自动提审、不正式上线**；预览是另一项远端操作，不等于上传开发版本。

`test` / `production`、不同 AppID 与自动版本/提交说明见[多环境上传](./environments.md)。

## 1. 配置源码项目 {#config}

下面是以 `src/` 为源码目录的最小完整 `vite.config.ts`。已有框架项目将这些字段合并到原配置，不要移除维持应用运行所需的插件。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'xhs',
    srcRoot: 'src',
  },
})
```

无需配置 `weapp.upload`：上传版本默认读取业务 `package.json.version`，说明按包名与最终版本自动生成 `name@version`；版本不会自动递增。仅需固定覆盖时才设置 `weapp.upload`，临时覆盖可用下文 CLI 参数。

`weapp.upload` 不是自动上传开关。普通 `wv build`、`wv dev` 和 HMR 都不会上传；配置文件中的 JavaScript 仍会正常求值，不要在配置求值阶段调用上传接口。Token 也不能写进 `weapp.upload`。

在源码根目录的 **`project.config.json`** 中设置以下字段，其他已有小红书配置保持不变。`replace-with-xhs-app-id` 是占位值，必须换成自己的小红书小程序 AppID：

```json
{
  "appid": "replace-with-xhs-app-id",
  "compileType": "miniprogram",
  "miniprogramRoot": "dist/"
}
```

本例的路径对应关系：

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

- AppID 字段必须是小写 **`appid`**，不能仅填写 `appId`。
- `weapp.srcRoot` 指向源码；`miniprogramRoot` 指向**构建产物**，两者不要都设为 `src/`。
- 本例没有额外覆盖 `build.outDir`，因此产物是 `dist/`，SDK 接收的项目目录是根目录 `.`。SDK 从该目录的 `project.config.json` 找到 `dist/app.json`。
- 上传前会检查 SDK 读取的代码目录与本次构建输出完全一致。自定义输出目录时必须保持这项对应关系；不要通过手改产物或指向旧 `dist` 绕过检查。

## 2. 安装官方工具并配置凭据 {#credentials}

在**使用 `weapp-vite` 的应用项目**内安装官方工具，不是装到全局或另一个项目：

```sh
pnpm add -D xhs-mp-cli
```

`weapp-vite` 从当前应用解析 `xhs-mp-cli/dist/ci.js`，使用独立的官方 CI 实例。仅安装全局 `xmc` 不满足这一依赖。官方文档说明免密秘钥功能从 `xhs-mp-cli@1.2.0` 开始支持；旧项目应更新依赖并提交锁文件。

### 取得哪一种 Token

需要的是目标小程序的**代码上传秘钥 / 免密登录 Token**。按[小红书官方免密秘钥说明](https://miniapp.xiaohongshu.com/doc/DC630678)，在目标应用的**小程序控制台 → 基础设置 → 代码上传秘钥**中获取；由具有相应权限的应用管理员操作，并同时核对 AppID。

将取得的代码上传秘钥作为一个完整 Token 字符串保存到下一节的 `XHS_UPLOAD_TOKEN`。[`xhs-mp-cli` 官方包 README](https://unpkg.com/xhs-mp-cli@2.1.6/README.md) 的“设置应用配置”明确将 `token` 称为“代码上传秘钥”，本入口会为对应 AppID 自动设置它，无需先运行 `xmc set-app-config`。

它不是业务开放接口的 `access_token`、AppSecret、云服务密钥，也不是文件路径；不要自行拼接或编码其他业务密钥来替代。若账号看不到官方文档所述入口，先确认应用与管理权限，以平台当前界面为准。**未取得对应秘钥时，可以先做 dry-run，但不能完成真实上传或预览。**

虽然官方 `xmc` 还有扫码登录功能，本入口只接受 Token：不需要先运行 `xmc login`，也不会在 Token 缺失或失效时隐式回退到扫码登录。预览结果供体验者使用的扫码入口，与开发者身份认证是两回事。

### 保存本地环境文件

在项目根目录创建 `.env.production.local`。下列 Token 和 AppID **都是占位值**；Token 应填写秘钥内容：

```dotenv
XHS_UPLOAD_TOKEN=replace-with-xhs-upload-token

# 可选；省略时读取 project.config.json 的 appid
# 如设置，必须与 project.config.json 中的 appid 完全一致
XHS_APP_ID=replace-with-xhs-app-id
```

`XHS_APP_ID` 不是跨应用覆盖开关。如果它与项目 `appid` 不一致，上传和预览都会拒绝执行；也不能只设置环境变量而省略项目配置中的 `appid`。

把以下规则加入 `.gitignore`，不要将环境文件放入 `src/`、静态资源目录或构建产物：

```text
.env.local
.env.*.local
```

默认 mode 为 `production`，依次加载 `.env` → `.env.local` → `.env.production` → `.env.production.local`，后者覆盖前者，已有进程环境变量优先级最高。`--mode test` 改用 `.env.test` / `.env.test.local`；若配置了 Vite `root`、`envDir` 或 `envDir: false`，按[环境与凭据规则](../upload.md#environment)确认实际加载位置。不要给凭据加 `VITE_` 前缀，也不要把 Token 直接放进命令行。

## 3. 先做无凭据构建检查 {#dry-run}

```sh
pnpm exec wv build --upload -p xhs --dry-run
```

这一步进行本次生产构建，并检查项目配置、SDK 代码根目录与本次产物的对应关系，以及 `app.json` 是否存在。成功时会看到 `[upload:xhs] dry-run` 提示。

**dry-run 不校验上传凭据、不加载官方上传 SDK、不调用远端服务**，因此可在尚未安装 `xhs-mp-cli` 或未配置 Token 时先运行。上传入口仍要求非空版本。它不会检查 Token 是否有效、AppID 是否有远端权限，也不能证明小红书已接受版本或真机可运行。

也可以只检查预览的构建路径：

```sh
pnpm exec wv preview -p xhs --dry-run
```

预览 dry-run 同样不生成预览链接或二维码。

## 4. 显式上传开发版本 {#upload}

确认已换成真实 AppID 和 Token 后，去掉 `--dry-run`：

```sh
pnpm exec wv build --upload -p xhs
```

本次构建成功、产物校验通过后，才调用小红书官方上传接口，默认使用业务包版本和自动生成的说明。成功会报告该版本上传完成（未提审、未正式发布）；再到目标应用的平台版本管理中确认开发版本，后续提审、发布仍由平台流程处理。

需要临时覆盖版本和说明时：

```sh
pnpm exec wv build --upload -p xhs --uv 1.2.4 --desc "修复首页展示"
```

也可以选择独立上传命令，它**自行重新构建后上传**，不需要先执行一次 `wv build`：

```sh
pnpm exec wv upload -p xhs --uv 1.2.4 --desc "修复首页展示"
```

以上两种方式二选一，避免重复上传。参数优先级是：

- 版本：`--uv` > `weapp.upload.version` > `package.json.version`。
- 说明：`--desc` > `weapp.upload.desc` > 根据包名与最终版本生成的 `name@version`；空白说明会使用生成值。

小红书适配器要求最终版本与说明非空，不在本地强制三段数字格式；建议采用官方 README 示例中的 `1.2.3` 形式，平台最终规则仍由官方服务校验。`--version` / `-v` 是查询 CLI 版本，**不是上传版本参数**。在 `build` 上使用 `--uv`、`--desc`、`--dry-run` 必须同时传 `--upload`，不能与 `--watch` 组合。更多选项见[公共命令说明](../upload.md#commands)。

## 5. 独立生成预览链接 {#preview}

```sh
pnpm exec wv preview -p xhs
```

命令先构建，再用同一组 AppID 和 Token 调用官方 `preview`，不调用开发版本上传接口。`preview` 不消费 `weapp.upload` 的版本或说明默认值，也**不接收 `--uv`**。

成功结果是 **预览链接（preview link）**，CLI 以 `[preview:xhs] 预览链接：…` 输出。虽然官方返回字段叫 `qrcodeUrl`，它表示二维码解码后的预览入口，**不是二维码图片 URL**。此入口不承诺生成本地 PNG，也不会自动打开浏览器或修改剪贴板；不要把这个值直接当成 `<img src>`。

链接的有效期、扫码者权限和可用宿主由小红书决定，拿到链接后仍需用有权限的设备验证。只有官方调用成功且返回有效链接才会报告预览已生成；不能把 dry-run 成功或普通构建成功当成预览成功。

## 6. 已启用 multiPlatform 的项目 {#multi-platform}

推荐把多平台配置集中在 `projectConfigs`，不再分别维护 JSON。保留其他平台与原有框架插件，仅演示小红书时：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'xhs',
    srcRoot: 'src',
    multiPlatform: {
      projectConfigs: {
        xhs: { appid: 'replace-with-xhs-app-id' },
      },
    },
  },
})
```

不用新建 `config/xhs/project.config.json`。默认生成 `dist/xhs/dist/project.config.json`，与 `app.json` 同级；SDK 项目目录为 `dist/xhs/dist`，生成配置的 `miniprogramRoot` 为 `.`。不要在输入对象里指定代码根或修改生成 JSON，自定义目录使用 `build.outDir`。公共项复用、多个 AppID 与 test/production 见[一份配置](../upload.md#batch)和[环境指南](./environments.md#appid)。

已有原生目录也可以继续使用：将 `multiPlatform` 设为 `{ projectConfigRoot: 'config', targets: ['xhs'] }`，源码配置放到 `config/xhs/project.config.json`，代码根仍为 `dist`；这时 SDK 项目目录是 `dist/xhs`，代码在 `dist/xhs/dist`。不要同时配置 `projectConfigs` 和 `projectConfigRoot`。

凭据仍放源码项目根目录的 `.env.production.local`，不放入项目配置或客户端。多平台仍显式传 `-p xhs`，不使用 `--project-config`；上面的 dry-run、上传、预览命令不变。批量与 CI 见[总览](../upload.md#batch)。

## 7. 小红书常见错误 {#troubleshooting}

| 现象                                                  | 检查与处理                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `无法解析上传工具 xhs-mp-cli/dist/ci.js`              | 在执行命令的应用项目中运行 `pnpm add -D xhs-mp-cli`；检查 CI 安装阶段是否省略了开发依赖。全局安装不能替代本地依赖。                          |
| `上传缺少环境变量 XHS_UPLOAD_TOKEN`                   | 检查 mode、环境文件目录和进程环境是否覆盖了本地值；必须提供代码上传秘钥内容，不是文件名或业务 `access_token`。                               |
| `project.config.json 的 appid 必须与 XHS_APP_ID…一致` | 统一配置检查 `projectConfigs.xhs.appid`；原生文件检查源码 JSON。删除过期环境变量或改为同一 AppID，不修改生成文件。 |
| `仅支持 Token 认证，禁止扫码登录`                     | 官方 SDK 试图进入登录流程，但本入口主动阻止了它。检查 Token 是否失效、是否属于该 AppID，以及账号授权；不要用 `xmc login` 掩盖 CI 凭据问题。  |
| `代码目录与本次构建输出不一致` / 缺少 `app.json`      | 对照本页根目录映射检查 `miniprogramRoot`、`build.outDir` 和完整小程序入口；仅有 `srcMiniprogramRoot` 不能替代 SDK 读取的 `miniprogramRoot`。 |
| `小红书预览未返回有效的预览链接`                      | 官方调用没有返回可用的 `qrcodeUrl`；检查官方工具版本、远端权限和平台响应，不要改用普通上传来冒充预览成功。                                   |
| dry-run 成功，真实请求仍被平台拒绝                    | dry-run 不验证秘钥与远端规则；按官方错误核对 AppID、代码上传权限、版本及包内容，再使用官方 IDE / 真机验证。                                  |

其他环境与命令问题见[公共排障](../upload.md#troubleshooting)。抖音同样使用 Token，但版本格式、官方工具和凭据存储行为不同，不能复用本页的 Token；详见[抖音上传与预览](./tt.md)。
