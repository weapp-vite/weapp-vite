# 小程序上传与预览速查

此文档随当前 `weapp-vite` 版本发布。面向已有可构建的小程序项目；完整分步教程见[上传与预览指南](https://vite.weapp.dev/guide/upload.html)。上传只产生开发版本，不自动提审或正式上线。

`test` / `production`、不同 AppID 与自动版本/提交说明见[多环境上传](https://vite.weapp.dev/guide/upload/environments.html)。

## 选择平台与凭据

先在业务项目安装目标平台的工具，例如 `pnpm add -D xhs-mp-cli`。不要只全局安装，也不需要为单个平台安装六套工具。

| 平台            | SDK 包              | 源码项目配置 / 代码根字段                 | 必需凭据和其他元数据                                                                      |
| --------------- | ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| 微信 `weapp`    | `miniprogram-ci`    | `project.config.json` / `miniprogramRoot` | `WEAPP_CI_PRIVATE_KEY_PATH`：代码上传私钥文件，不是 AppSecret                             |
| 小红书 `xhs`    | `xhs-mp-cli`        | `project.config.json` / `miniprogramRoot` | `XHS_UPLOAD_TOKEN`：官方代码上传秘钥内容                                                  |
| 抖音 `tt`       | `tt-ide-cli`        | `project.config.json` / `miniprogramRoot` | `TT_UPLOAD_TOKEN`：官方 CLI Token                                                         |
| 支付宝 `alipay` | `minidev`           | `mini.project.json` / `miniprogramRoot`   | `ALIPAY_IDENTITY_KEY_PATH`：含 `alipay.authentication` 的官方 JSON 身份密钥文件，不是 PEM |
| 京东 `jd`       | `jd-miniprogram-ci` | `project.config.json` / `miniprogramRoot` | `JD_PRIVATE_KEY`：完整密钥内容，不是文件路径                                              |
| 百度 `swan`     | `swan-toolkit`      | `project.swan.json` / `smartProgramRoot`  | `SWAN_UPLOAD_TOKEN`：BDUSS；`SWAN_MIN_VERSION`：最低基础库版本，不是应用版本              |

**淘宝不支持**：当前没有 `taobao` 平台或上传适配器，`alipay` 固定使用支付宝客户端，不能冒充淘宝。Web、组件库、独立插件也不在此入口范围内。

AppID 写入源码侧项目配置的 `appid`。微信可用 `WEAPP_CI_APPID`、支付宝可用 `ALIPAY_APP_ID` 覆盖上传使用的 ID，但必须与密钥授权一致；抖音 `TT_APP_ID`、小红书 `XHS_APP_ID` 如设置，必须与生成项目配置的 `appid` 相同，不能用来切换应用。抖音、小红书、百度不能只填写 `appId`；京东和百度没有 AppID 环境覆盖项。

## 单平台完整配置与命令

以小红书为例，已有项目保留其他构建配置。`vite.config.ts`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'xhs',
    srcRoot: 'src',
  },
})
```

源码根 `project.config.json` 的最小上传相关字段（占位值必须替换；已有配置保留其他字段）：

```json
{
  "appid": "replace-with-xhs-app-id",
  "compileType": "miniprogram",
  "miniprogramRoot": "dist"
}
```

源码根 `.env.production.local`：

```dotenv
XHS_UPLOAD_TOKEN=replace-with-official-code-upload-secret
```

```bash
pnpm add -D xhs-mp-cli
pnpm exec wv build --upload -p xhs --dry-run
pnpm exec wv build --upload -p xhs
pnpm exec wv preview -p xhs --desc "验收首页"
```

无需配置 `weapp.upload`：版本默认读取业务 `package.json.version`，说明按包名与最终版本自动生成 `name@version`，版本不会自动递增。仅需固定覆盖时才设置 `weapp.upload.version` / `desc`；一次性覆盖可用 CLI：

```bash
pnpm exec wv build --upload -p xhs --uv 1.2.4 --desc "修复首页展示"
```

版本优先级为 CLI `--uv` > `weapp.upload.version` > `package.json.version`；说明为 CLI `--desc` > `weapp.upload.desc` > 自动生成值。去除首尾空白；显式空版本报错，空说明用自动生成值。普通 `build`、`dev/HMR` 不启用上传，配置文件本身仍正常求值。`preview` 不使用 `weapp.upload` 默认参数，不需要版本也不接受 `--uv`。

`build --upload` 只编译一次，等本次所有后端构建成功、产物校验通过才上传。独立 `wv upload` 也会自行构建，不需要先执行 `build`。普通 build 不能单独带 `--uv` / `--desc` / `--dry-run`；上传不能与 `--watch` 或 Web-only 组合。

## 环境与密钥安全

- 默认 mode 为 `production`；`--mode test` 选择测试环境文件，但仍是生产构建。
- 覆盖优先级：`.env` → `.env.local` → `.env.<mode>` → `.env.<mode>.local` → 进程环境。不要用保留的 mode `local`。
- 环境目录由 Vite `root` / `envDir` 决定；`envDir: false` 只读取进程环境。
- 两个密钥文件路径相对源码项目根（命令的 `[root]`），不是相对环境目录或输出目录。
- `.env.local`、`.env.*.local`、`.keys/` 加入 `.gitignore`；密钥放在源码和静态资源目录之外，不加 `VITE_` 前缀。
- CI 使用 Secrets 或临时安全文件，测试通过后显式上传；文件用后删除，不向不可信 PR 暴露凭据。

## 多平台与输出校验

多个平台推荐在一份 `vite.config.ts` 中使用 `weapp.multiPlatform.projectConfigs`，不用分别维护原生项目 JSON：

```ts
import { defineConfig } from 'weapp-vite/config'

const common = { projectname: 'my-app' }

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    multiPlatform: {
      projectConfigs: {
        xhs: { ...common, appid: 'replace-with-xhs-app-id' },
        tt: { ...common, appid: 'replace-with-douyin-app-id' },
      },
    },
  },
})
```

省略 `targets` 时从平台键推导允许列表；公共字段用普通对象展开，平台字段覆盖公共字段，不做隐式深合并。标准项目 JSON 由打包器生成在代码目录内，默认 `dist/<平台>/dist/`，SDK 代码根为 `.`。不要在输入对象中写 `miniprogramRoot`、`srcMiniprogramRoot`、`smartProgramRoot`，自定义目录使用 `build.outDir`。不读原生或私有项目 JSON；缺少选中平台直接报错，不回退到旧文件。

原生文件模式仍可使用 `projectConfigRoot`：源配置位于 `config/<平台>/` 下；代码根为 `dist` 时，配置复制至 `dist/<平台>/`，代码在 `dist/<平台>/dist/`。两种来源不能同时配置。多平台仍显式传 `-p`，不能使用 `--project-config`；单平台原生文件可指定该参数，但文件名必须是目标平台的标准名称。Token/私钥始终留在环境变量，不写入项目配置。

```bash
pnpm exec wv upload -p xhs,tt
pnpm exec wv upload -p all --dry-run
pnpm exec wv preview -p xhs,tt
```

`upload/preview -p all` 是六端：微信、支付宝、抖音、小红书、京东、百度；`build -p all --upload` 则是“小程序 + Web”，不是六端。`build` 不接受多个小程序平台的逗号列表。批量串行、首次失败停止，成功的前序平台不会自动撤回；仅配置部分平台时显式列出它们，`all` 不会按 `multiPlatform.targets` 自动缩减。

每次校验 SDK 代码根与本次输出实际路径相同且含 `app.json`。百度检查 `smartProgramRoot`，其他平台检查 `miniprogramRoot`；不要用 `srcMiniprogramRoot` 替代，也不要通过修改旧 `dist` 绕过校验。

## 平台限制与预览结果

- 微信：上传私钥对应 AppID，配置平台 IP 白名单；可选 `WEAPP_CI_ROBOT` 为 1–30。预览图片输出到 `.weapp-vite/preview/`。
- 支付宝：上传版本为三段数字、无前导零、每段不超过 2147483647；说明少于 200 字符。预览返回二维码图片 URL。
- 抖音：上传版本为三段数字。SDK 会在本地保存 Token，使用隔离 runner。预览返回扫码链接。
- 小红书：只走 Token 认证，不回退扫码登录。预览返回扫码链接。
- 京东：上传与预览共用官方 SDK 临时包，同机共享临时目录的任务必须串行；预览返回二维码图片 URL。
- 百度：上传版本为二至四段数字；预览也必填 `SWAN_MIN_VERSION`，只支持普通小程序。BDUSS 出现在 SDK 子进程参数中，使用可信隔离 runner；预览返回默认基础库的扫码链接。

`--dry-run` 不加载 SDK、不校验凭据或官方平台规则、不生成二维码；上传入口仍要求非空版本。它不能证明平台授权、网络、IP 白名单或扫码权限正确。上传失败后保留错误并定位根因，不把 SDK 提前退出视为成功；取消命令不能撤回已被平台接收的版本。

## 完整教程

- [微信](https://vite.weapp.dev/guide/upload/weapp.html)
- [小红书](https://vite.weapp.dev/guide/upload/xhs.html)
- [抖音](https://vite.weapp.dev/guide/upload/tt.html)
- [支付宝及淘宝边界](https://vite.weapp.dev/guide/upload/alipay.html)
- [京东](https://vite.weapp.dev/guide/upload/jd.html)
- [百度](https://vite.weapp.dev/guide/upload/swan.html)
- [批量操作](https://vite.weapp.dev/guide/upload.html#batch)、[CI 示例](https://vite.weapp.dev/guide/upload.html#ci)、[排障](https://vite.weapp.dev/guide/upload.html#troubleshooting)

旧微信 IDE 参数应迁移为 `wv ide upload --project <IDE项目根> -v 1.2.3 -d "说明"` / `wv ide preview --project <IDE项目根>`。这些显式 IDE 命令依赖登录，不额外构建；新命令不会隐式回退到它们。
