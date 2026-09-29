# 小程序上传与预览速查

此文档随当前 `weapp-vite` 版本发布。面向已有可构建的小程序项目；完整分步教程见[上传与预览指南](https://vite.weapp.dev/guide/upload.html)。上传只产生开发版本，不自动提审或正式上线。

`test` / `production`、不同 AppID 与自动版本/提交说明见[多环境上传](https://vite.weapp.dev/guide/upload/environments.html)。

下文的构建、环境凭据、dry-run 与自动版本规则只适用于 SDK 入口；原有微信 IDE 顶层上传保留原参数行为，见[旧上传兼容与迁移](#旧上传兼容与迁移)。

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

无需配置 `weapp.upload`：版本默认读取业务 `package.json.version`，说明按包名与最终版本自动生成 `name@version`；默认不升版、不读取 Git、不运行 npm。仅需固定覆盖时才设置 `weapp.upload.version` / `desc`；一次性覆盖可用 CLI：

```bash
pnpm exec wv build --upload -p xhs --uv 1.2.4 --desc "修复首页展示"
```

版本优先级为 CLI `--uv` 或 `--bump` 生成值 > `weapp.upload.version` > `package.json.version`；说明为 CLI `--desc` 或 `--git-desc` 生成值 > `weapp.upload.desc` > 自动生成值。去除首尾空白；显式空版本报错，空说明用自动生成值。普通 `build`、`dev/HMR` 不启用上传，配置文件本身仍正常求值。`preview` 不使用 `weapp.upload` 默认参数，不需要版本，也不接受 `--uv`、`--bump` 或 `--git-desc`。

`build --upload` 只编译一次，等本次所有后端构建成功、产物校验通过才上传。SDK `wv upload` 也会自行构建，不需要先执行 `build`。普通 build 不能单独带 `--uv` / `--desc` / `--bump` / `--git-desc` / `--dry-run`；上传不能与 `--watch` 或 Web-only 组合。

## 内置本地自动版本

不需要辅助脚本或额外依赖；沿用已配置的应用与平台，从应用根目录执行：

```sh
# 计算下一版本和说明，构建但不修改版本文件、不上传
pnpm exec wv upload -p xhs,tt --mode test --bump patch --git-desc --dry-run

# 确认后选择批量或单目标入口，不要重复执行两条真实上传命令
pnpm exec wv upload -p xhs,tt --mode test --bump patch --git-desc
pnpm exec wv build --upload -p xhs --mode test --bump patch --git-desc
```

- `--bump <release>` 只接受 `patch`、`minor`、`major`，要求应用有合法的 SemVer 版本；与显式 `--uv` 冲突。
- `--git-desc` 读取最新 Git 提交的 subject，不读取正文；与显式 `--desc` 冲突。生成的版本和说明覆盖 `weapp.upload` 默认值。
- 两个选项可独立启用，只用于 `upload` / `build --upload`，不能放进 Vite 上传配置。真实升版需要本机 npm；只有 `--git-desc` 要求 Git 可执行且仓库已有提交。
- 只处理命令 `[root]` 直接包含的 `package.json`；省略 root 即当前目录，不向父目录查找，Vite `root` / `envDir` 不改变目标。首次编译器初始化、配置求值前只准备一次，整批共用版本与说明。
- 真实升版由 npm 标准 `version` 操作更新应用版本与适用的 npm 锁文件，不同步 `pnpm-lock.yaml`。`--prefix`、工作目录均限定为应用根，传入 `--no-git-tag-version --ignore-scripts --workspaces=false`，不修改外层 workspace 根包，不运行生命周期钩子、不 commit/tag/push。
- dry-run 不运行 `npm version`，不修改版本或锁文件；直接导入 `package.json` 的构建代码仍读取原始版本，而不是预计上传版本。演练不要求 npm，启用 `--git-desc` 时仍要求 Git。
- 参数冲突、无效 release / 当前版本、Git 失败都在文件修改前报错。升版完成后构建或上传失败不回滚；只重试未完成的平台，去掉 `--bump`，必要时用 `--uv` / `--desc` 显式复用上一批版本与说明。

CI 可继续按 `run_number` 生成版本并显式传 `--uv` / `--desc`，不需要改写应用版本文件。完整工作流见[多环境上传](https://vite.weapp.dev/guide/upload/environments.html#ci)。

## 环境与密钥安全

- 默认 mode 为 `production`；`--mode test` 选择测试环境文件，但仍是生产构建。
- 覆盖优先级：`.env` → `.env.local` → `.env.<mode>` → `.env.<mode>.local` → 进程环境。不要用保留的 mode `local`。
- 环境目录由 Vite `root` / `envDir` 决定；`envDir: false` 只读取进程环境。
- 两个密钥文件路径相对源码项目根（命令的 `[root]`），不是相对环境目录或输出目录。
- `.env.local`、`.env.*.local`、`.keys/` 加入 `.gitignore`；密钥放在源码和静态资源目录之外，不加 `VITE_` 前缀。
- CI 使用 Secrets 或临时安全文件，测试通过后显式上传；文件用后删除，不向不可信 PR 暴露凭据。

## 多平台与输出校验

单平台根目录原生 JSON、多平台各端独立 JSON、统一 `projectConfigs` 三种入口都保留，不强制迁移。想减少重复文件时，可以在一份 `vite.config.ts` 中使用 `weapp.multiPlatform.projectConfigs`：

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

平台字段和嵌套设置提供智能提示，同时保留未知原生扩展字段及新增字符串取值，不需要 `as any`。独立映射可从 `weapp-vite/config` 导入 `MultiPlatformProjectConfigs`，使用 `satisfies MultiPlatformProjectConfigs` 保留补全和扩展字段推导。已知字段类型、六端平台键和生成代码根限制仍生效；未知字段是否可用由原生工具决定。

`defineConfig` 保持通用泛型推导，不做精确对象校验；混合正确与错误平台键时，TypeScript 可能不报错。需要静态检查平台名拼写时用上述 `satisfies`，构建时仍拒绝不支持的平台。

原生文件模式仍支持各端独立维护：默认 `projectConfigRoot: 'config'` 从 `config/<平台>/` 读取 JSON；若使用 `weapp/project.config.json`、`alipay/mini.project.json`、`tt/project.config.json`、`xhs/project.config.json`、`jd/project.config.json`、`swan/project.swan.json` 这些项目根下的平台目录，设为 `projectConfigRoot: '.'` 即可。只维护部分平台时显式选择这些平台，不需要补齐其余文件。

原生代码根为 `dist` 时，配置复制至 `dist/<平台>/`，代码在 `dist/<平台>/dist/`。两种多平台来源不能同时配置。多平台仍显式传 `-p`，不能使用 `--project-config`；单平台不启用 multiPlatform 时仍读取根目录原生 JSON，也可指定该参数，但文件名必须是目标平台的标准名称。Token/私钥始终留在环境变量，不写入项目配置。

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

## 结构化结果与本地超时

```bash
wv upload -p xhs,tt --json --timeout 180 > upload-report.json
wv upload -p all --dry-run --json
```

`--json` 让 stdout 只输出一个报告，日志和官方进度进入 stderr；失败退出码非零。不使用 JSON 时仍打印逐平台汇总。`--json` / `--timeout` 仅适用于独立 SDK `upload`，不适用于 `build --upload`、`preview`、IDE 上传或 `weapp.upload` 配置。

报告为 `{ schemaVersion: 1, action: "upload", status, results, error? }`。整批 `status` 为 `success` / `failed`；`results` 按请求顺序保留各平台的 `platform`、可选 `requestedVersion`、最后进入的 `stage`（`prepare` / `build` / `validate` / `upload`）及 `status`（`success` / `failed` / `not-run` / `dry-run` / `unknown`）。从配置推断但尚未解析的平台为 `null`；列表解析前失败时 `results` 可为空。首次失败后保留前序结果，后续条目为 `not-run`。

成功条目的 `result` 只含官方实际返回的可选信息：微信的 `subPackages` / `plugins`（体积为字节），支付宝的 `sdkVersion` / `qrCodeUrl`，抖音的 `previewUrl` / `qrCodeFile`，京东的 `qrCodeUrl` / `qrCodeBase64`，百度的 `previewUrl` / `fileSize` / `warnings`；小红书成功结果为 `{}`。不从请求版本或内部标识推断 SDK 确认版本，不因可选信息缺失而改判失败。字段结构见[完整结果参考](https://vite.weapp.dev/guide/upload.html#report)。

进度只使用公开能力：微信任务状态／消息、小红书百分比、支付宝日志／任务创建／版本创建事件。其他平台不伪造百分比；任何进度事件都不能替代 SDK 完成确认和正常退出。

`--timeout` 是每个平台 SDK worker 的本地超时，不含构建；默认不增加超时。值为正数秒，精度不超过毫秒，最大 `2147483.647` 秒。SDK 执行期间，`SIGINT` / `SIGTERM` 或超时会触发本地上传进程树清理，无法确认清理完成时报告错误。构建等前置阶段保留原有信号退出行为，不等待挂起的构建，也不保证生成最终报告。

Windows 使用 PowerShell 查询已退出 worker 的子进程归属，单次查询最多等待 30 秒；这是 SDK 执行结束后的本地清理预算，不包含在 `--timeout` 内。查询或终止失败仍然报错，不会跳过清理或自动重试上传。

SDK 开始后超时／中断标记 `status: "unknown"`、`remoteOutcome: "unknown"`；SDK 尚未开始时可为 `remoteOutcome: "not-started"`。其他 SDK 错误也可能携带 `remoteOutcome: "unknown"`。**本地停止不代表远端取消**，先核实平台状态再重试；不会自动重试、回滚、提审、设置体验版或正式发布。

## 完整教程

- [微信](https://vite.weapp.dev/guide/upload/weapp.html)
- [小红书](https://vite.weapp.dev/guide/upload/xhs.html)
- [抖音](https://vite.weapp.dev/guide/upload/tt.html)
- [支付宝及淘宝边界](https://vite.weapp.dev/guide/upload/alipay.html)
- [京东](https://vite.weapp.dev/guide/upload/jd.html)
- [百度](https://vite.weapp.dev/guide/upload/swan.html)
- [批量操作](https://vite.weapp.dev/guide/upload.html#batch)、[CI 示例](https://vite.weapp.dev/guide/upload.html#ci)、[排障](https://vite.weapp.dev/guide/upload.html#troubleshooting)

## 旧上传兼容与迁移

原有微信 IDE 上传的长、短参数保持不变，无需立即改写脚本：

```bash
wv upload --project ./dist --version 1.2.3 --desc "release"
wv upload -p ./dist -v 1.2.3 -d "release"
wv upload --project=./dist --version=1.2.3 --desc="release"
```

旧入口保留版本、说明和项目定位的原始语义。上述 `./dist` 仅是 IDE 工程路径示例，应替换为包含 `project.config.json` 的实际工程根；省略 `--project/-p` 或 `--appid` 时仍保持透传，不会自动补 `dist`，由官方 CLI 处理。顶层旧语法每次调用只警告一次，提示未来将移除；稳定的 `wv ide upload -p ./dist -v 1.2.3 -d "release"` 不弃用、不警告。两者沿用 IDE 登录和已有项目，不额外运行 weapp-vite 构建。

普通 SDK 上传直接执行 `wv upload -p weapp`，无需 `--project`：框架自动依据项目配置与本轮实际写出目录定位产物。多平台默认代码目录是 `dist/<平台>/dist/`，也支持自定义输出；不是固定上传 `./dist`。

SDK 迁移不是等价换名：回到包含 `package.json`、Vite 配置和源码的项目根，安装 `miniprogram-ci` 并配置 AppID、上传私钥和 IP 白名单，再执行 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`。不要把旧 `--project` 的构建产物目录当作 SDK `[root]`；SDK 需要新凭据，不复用 IDE 登录。

- 旧标记为 `--version/-v`、`--project`、`--appid`、`--ext-appid`、`--info-output/-i`；SDK 标记为长参数 `--platform`、`--uv`、`--bump`、`--git-desc`、`--dry-run`、`--json`、`--timeout`。混用在 IDE、编译或版本修改前报错；SDK 标记的 `--no-*` 形式也不能混入旧调用。SDK 专属选项不适用于 IDE。
- `-p` 仅在有旧标记时表示 IDE 项目目录，否则表示原生平台；不根据路径存在与否或值是否像平台名猜测。`--desc` 共用，`-d` 仅在旧调用中是说明，原生命令中仍是 debug。
- 参数支持分开和 `=` 形式；必填值只是数据，仅在选项位置遇到 `--` 后停止扫描。
- `wv upload --help` 查看 SDK 帮助；`wv help upload` 保留旧 IDE 帮助并警告未来弃用；`wv ide help upload` 保持显式 IDE 帮助、不警告。工具自身版本查询用 `wv --version`。
- 兼容只覆盖顶层旧上传，不包含顶层预览。`wv preview` 仍走 SDK；IDE 预览继续用 `wv ide preview --project ./dist`。
