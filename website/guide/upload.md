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

下文的构建、凭据、dry-run 和自动版本规则仅针对 SDK 入口。原有顶层微信 IDE 上传仍保留原参数行为，只提示未来弃用；见[旧上传兼容与迁移](#legacy-upload)。这项兼容不包含顶层 `preview`。

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

默认读取业务 `package.json.version`，说明自动生成为 `项目名@版本`，无需每次修改配置；默认不升版、不读取 Git、不运行 npm。需要本地升版与最新提交标题时，显式使用内置 [`--bump` / `--git-desc`](./upload/environments.md#local-version)；[CI](./upload/environments.md#ci) 仍可直接传版本和说明，无需修改版本文件。`weapp.upload` 仅用于可选的版本/说明覆盖，不接受 AppID、凭据或自动升版选项。

- 版本：CLI `--uv` 或 `--bump` 生成值 > `weapp.upload.version` > `package.json.version`；`--uv` 与 `--bump` 不能同时传。
- 说明：CLI `--desc` 或 `--git-desc` 生成值 > `weapp.upload.desc` > 根据项目名称与最终版本生成的说明；`--desc` 与 `--git-desc` 不能同时传。
- 参数保持字符串语义后去除首尾空白；显式空版本会报错，空说明使用默认说明。字符串可以保留前导零，但还要满足目标平台的版本规则。
- 普通构建、开发重建不启用上传；`preview` 不使用 `weapp.upload` 默认参数。
- 配置文件仍会正常加载与合并，上传开关不保证 JavaScript getter 延迟求值。不要在配置文件求值时执行上传副作用。

## 2. 环境文件、密钥和路径 {#environment}

默认将目标平台需要的变量写入源码项目根目录的 `.env.production.local`，只保留使用的平台。各平台页面提供对应的文件内容，所有 `replace-with-...` 都必须替换为自己的值，不是有效凭据。

加载优先级从低到高：`.env` → `.env.local` → `.env.<mode>` → `.env.<mode>.local` → 已有进程环境变量；支持变量引用。上传和预览默认 mode 为 `production`，`--mode test` 改为选择 `.env.test` / `.env.test.local` 等文件，但仍执行生产构建。不要使用保留的 `--mode local`。

环境文件采用 `dotenv-expand 1000.0.0` 的展开语义：文件值中的 `$(...)` 会执行命令替换；提供 `DOTENV_PRIVATE_KEY` 时，以 `encrypted:` 开头的文件值会尝试解密，未提供私钥时保留该值。此版本没有公开的命令替换或解密禁用开关，给 `$(...)` 添加反斜杠也不能阻止命令替换；只加载可信的环境文件。

已有进程环境变量的同名值（包括空字符串）原样采用，优先级最高。被它覆盖的文件值不参与展开，因此不会执行该文件值的命令替换或解密。上传环境加载使用副本，不将展开后的凭据写回 `process.env`。

如果凭据本身需要包含字面 `$(...)`，通过 CI Secrets 或进程环境直接提供该凭据，不要写入环境文件，也不要在其他文件变量中再次引用它；引用展开后的 `$(...)` 仍可能触发命令替换。

单层反向引用仍可使用，例如先写 `A=$B`、后写 `B=value`；多级反向引用不会保证递归展开。按 `A=$B`、`B=$C`、`C=value` 排列时，`A` 的结果是字面 `$C`，`B` 和 `C` 才是 `value`。多级引用请先定义基础值，再按依赖顺序声明：

```dotenv
C=value
B=$C
A=$B
```

变量引用必须无环，否则展开可能停滞。避免在同一文件重复声明同名变量；需要覆盖时放入更高优先级的环境文件，并先声明基础值、再声明引用它的变量。合并后的文件变量按最后生效声明的位置展开，确保后续引用使用已展开的命令输出或解密结果。

默认值与替代值表达式区分“未定义”和“已定义为空字符串”：

| 表达式 | `VAR` 未定义 | `VAR` 是空字符串 |
| --- | --- | --- |
| `${VAR-fallback}` | `fallback` | 空字符串 |
| `${VAR:-fallback}` | `fallback` | `fallback` |
| `${VAR+alternate}` | 空字符串 | `alternate` |
| `${VAR:+alternate}` | 空字符串 | 空字符串 |

| 项目                              | 相对路径基准                                         |
| --------------------------------- | ---------------------------------------------------- |
| 命令的 `[root]`                   | 当前工作目录；省略时使用当前目录                     |
| 环境文件目录                      | Vite `root`；设置 `envDir` 时相对 Vite `root` 解析   |
| 微信 `WEAPP_CI_PRIVATE_KEY_PATH`  | 源码项目根目录，即命令的 `[root]`                    |
| 支付宝 `ALIPAY_IDENTITY_KEY_PATH` | 源码项目根目录，即命令的 `[root]`                    |
| 项目配置内的代码根字段            | SDK 读取的项目配置所在目录，必须指向本次真实构建输出 |

顶层 `envDir: false` 完全禁用此入口的环境文件加载与展开，只读取进程环境，不对其值执行命令替换或解密。更改 Vite `root` / `envDir` 不会改变两个密钥文件路径的基准。

在业务项目 `.gitignore` 中加入：

```text
.env.local
.env.*.local
.keys/
```

把 `.keys/` 放在源码和静态资源目录之外；不要复制到构建产物。不要给凭据加 `VITE_` 前缀、写入客户端源码、打印到日志或放进命令行参数。CI 应使用 Secrets 或安全文件；不要向不可信 PR 暴露凭据。

## 3. 选择正确的命令 {#commands}

以下命令都从源码项目根目录执行，不是在旧 `dist` 中操作。**SDK 上传无需 `--project`**：CLI 会根据项目配置和本轮实际写出目录自动定位产物，而不是固定读取 `./dist`。多平台默认代码目录是 `dist/<平台>/dist/`，自定义输出按 `build.outDir` 等构建设置处理。

```bash
# 只构建，不上传；即使已经配置 weapp.upload 也一样
pnpm exec wv build -p xhs

# 构建并检查产物；不校验凭据、不加载上传 SDK
pnpm exec wv build --upload -p xhs --dry-run

# 复用本次构建，校验产物后上传开发版本
pnpm exec wv build --upload -p xhs

# 独立上传入口也会先构建，不需要先执行一次 build
pnpm exec wv upload -p xhs

# 显式本地升版并使用最新 Git 提交标题；先演练，不改版本文件
pnpm exec wv upload -p xhs --bump patch --git-desc --dry-run

# 单独构建预览，不上传开发版本，不接受 --uv / --bump / --git-desc
pnpm exec wv preview -p xhs --desc "验收首页"
```

| 需求                                          | 选择与边界                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 调整 `--outDir`、`--minify` 等构建参数后上传  | `build --upload`，保留 `build` 的选项，不重复构建                                                                           |
| 只验证构建和目录关系                          | 上传或预览命令加 `--dry-run`；上传仍要求非空版本，但不验证凭据、平台专属版本规则、IP 白名单、网络或扫码权限                 |
| 开发时 watch/HMR                              | 不上传；`build --watch --upload` 会报错                                                                                     |
| 普通 build 传上传选项 | `--uv` / `--desc` / `--bump` / `--git-desc` / `--dry-run` 必须同时传 `--upload`，否则报错 |
| Web-only                                      | `build -p web --upload` 不支持                                                                                              |
| 上传已经存在的旧产物、不再构建                | 新入口不提供此模式，避免误传旧版本                                                                                          |
| 沿用已登录微信 IDE 的旧脚本                   | 旧 `wv upload --project <IDE项目根> -v 1.2.3 -d "说明"` 仍可用并提示未来弃用；稳定入口为 `wv ide upload ...`，预览用 `wv ide preview --project <IDE项目根>`；均不额外触发 weapp-vite 构建 |

成功时 CLI 明确区分“上传完成”和“预览已生成”，前者仍未提审、未正式发布。微信预览产生本地二维码图片；支付宝、京东返回二维码图片 URL；抖音、小红书、百度返回扫码目标或预览链接。工具不会自动打开浏览器或修改剪贴板。

`--bump patch|minor|major` 只处理命令 `[root]` 下的应用 `package.json`，不向父目录查找；真实升版需要本机 npm。`--git-desc` 单独要求 Git 仓库已有提交。二者在首次编译器初始化、配置求值前各执行一次，批量共用结果。真实升版使用 npm 标准版本更新，不执行生命周期钩子、不 commit/tag/push；后续构建或上传失败不回滚，重试时去掉 `--bump` 并复用原版本。`--dry-run` 不运行 npm、不修改版本或锁文件，导入 `package.json` 的构建代码仍读取原始版本。完整前提与重试示例见[本地自动版本](./upload/environments.md#local-version)。

### 旧微信 IDE 上传兼容与迁移 {#legacy-upload}

旧上传脚本不用立即改写，以下长、短参数均保持原样：

```bash
wv upload --project ./dist --version 1.2.3 --desc "release"
wv upload -p ./dist -v 1.2.3 -d "release"
```

这里的 `./dist` 仅假设原脚本的 IDE 工程根在那里，**不是默认值**；应使用包含 `project.config.json` 的实际 IDE 工程目录，而非把代码输出目录一概当作工程根。旧入口保持原样透传，省略定位参数时不会替你补 `./dist`，其余行为交给官方 IDE CLI；也可沿用原脚本的 `--appid` 定位。新的 `wv upload -p weapp` 则无需手填这条路径。

这类顶层调用每次警告一次，说明未来将移除；显式 `wv ide upload -p ./dist -v 1.2.3 -d "release"` 不弃用，也不发出该警告。二者继续使用已登录的微信 IDE 与已有 IDE 项目，不额外运行 weapp-vite 构建。

需要改用 SDK 时，先按[微信指南](./upload/weapp.md)在**源码项目根目录**安装 `miniprogram-ci`，配置 AppID、代码上传私钥和 IP 白名单，再执行 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`。这是重新构建并使用新凭据的流程，不是 IDE 命令的等价替换；不要把旧 `--project` 的 `dist` 目录直接复制成新命令的 `[root]`。

顶层分流由明确参数决定：旧标记为 `--version/-v`、`--project`、`--appid`、`--ext-appid`、`--info-output/-i`；SDK 标记为长参数 `--platform`、`--uv`、`--bump`、`--git-desc`、`--dry-run`、`--json`、`--timeout`。两组混用在 IDE、编译或升版副作用前报错，SDK 标记的 `--no-*` 形式也不能绕过检查。这些 SDK 专属选项不适用于 IDE。

`-p` 本身不决定后端：有旧标记时是 IDE 项目目录，否则是平台；不按值是否像平台名或文件是否存在猜测。`--desc` 共用，`-d` 只在旧调用中保留说明含义，原生命令仍将其作为 debug。参数支持分开和 `=` 形式，必填值不当作标记，仅在选项位置遇到 `--` 后停止扫描。完整规则见 [CLI 参考](./cli.md#legacy-upload)。

`wv upload --help` 是 SDK 帮助；`wv help upload` 保留旧 IDE 帮助并警告未来弃用；`wv ide help upload` 是不弃用的显式帮助。顶层 `wv preview` 仍只走 SDK；沿用 IDE 预览须使用 `wv ide preview --project ./dist`。

## 4. 一份配置与批量上传 {#batch}

三种配置方式都保留，不强制迁移：单平台使用根目录原生 JSON，多平台使用各端独立 JSON，或者在一份 Vite 配置中自动生成 JSON。它们都可以使用上传与预览命令，按项目维护习惯选择即可。

### 方式一：一份 Vite 配置自动生成

多个平台可以在 **一份 `vite.config.ts`** 中使用 `projectConfigs`，不必手工维护六个文件。公共字段用普通对象展开复用，各平台只填写自己的 AppID 和差异：

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

#### 智能提示与扩展字段 {#native-types}

已知字段按平台补全，例如微信 `setting`、支付宝 `compileOptions`、百度 `compilation-args.common`，不会把一端的设置套到其他端。**原生配置对象及其嵌套设置允许新增未知字段**，已知字符串选项也保留后续新增取值，不需要 `as any`；最终是否支持这些字段仍由该端原生工具决定。京东未建立可靠 schema 的设置保持透传，不伪造补全。

如果把映射提取为独立变量，可以使用公开的 `MultiPlatformProjectConfigs` 配合 `satisfies`：既保留平台字段提示，也保留扩展字段自身的类型推导。下面的 `futureNativeOption` 仅演示未来扩展字段，不代表现有原生工具已支持该开关：

```ts
import type { MultiPlatformProjectConfigs } from 'weapp-vite/config'
import { defineConfig } from 'weapp-vite/config'

const projectConfigs = {
  weapp: {
    appid: 'replace-with-weapp-app-id',
    setting: {
      es6: false,
      futureNativeOption: { enabled: true },
    },
  },
  alipay: {
    appid: 'replace-with-alipay-app-id',
    format: 2,
    compileType: 'mini',
    compileOptions: { typescript: false },
  },
} satisfies MultiPlatformProjectConfigs

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    multiPlatform: { projectConfigs },
  },
})
```

扩展能力不等于关闭所有检查：平台名仍限于支持的六端，AppID 仍为字符串，已知布尔字段不能写成字符串；由构建器管理的三个代码根字段仍禁止写入。

`defineConfig` 保留 Vite 配置的泛型推导，不是精确对象校验器；混合了正确与错误平台键的内联对象可能通过 TypeScript 检查。需要静态检查平台名拼写时，使用上面的 `satisfies MultiPlatformProjectConfigs`；构建时仍校验平台键并拒绝不支持的平台。

### 方式二：保留各端独立原生 JSON

已有原生项目配置不需要改写成 TypeScript 对象。下面这种布局同样支持多端批量上传：

```text
vite.config.ts
weapp/project.config.json
alipay/mini.project.json
tt/project.config.json
xhs/project.config.json
jd/project.config.json
swan/project.swan.json
```

这些平台目录位于业务项目根时，设置 `projectConfigRoot: '.'`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    multiPlatform: {
      projectConfigRoot: '.',
    },
  },
})
```

如果平台目录位于 `config/` 下，设置 `projectConfigRoot: 'config'`；这也是 `multiPlatform: true` 的默认位置。只维护部分平台时可加 `targets: ['weapp', 'xhs']`，仅选择已有配置的平台执行，不要求补齐其他四端文件。

每个 JSON 独立维护该端 AppID 和原生设置；代码根通常为 `miniprogramRoot: 'dist'`，百度使用 `smartProgramRoot: 'dist'`。这种方式默认将项目 JSON 放到 `dist/<平台>/`，代码放到 `dist/<平台>/dist/`。单平台项目不启用多平台模式时，仍读取源码项目根的原生 JSON，详见各平台分篇。

两种多平台来源不能同时配置；统一配置缺少选中平台时直接报错，不回退到旧文件，避免意外使用另一套 AppID。启用多平台模式后不使用 `--project-config`。原生文件模式的 SDK 代码根仍须与实际输出一致，详见[多平台配置](./multi-platform.md)。

### 两种多平台方式共用的命令

```bash
# 单次构建上传一个平台；要求明确 -p
pnpm exec wv build --upload -p xhs

# 按给定顺序分别构建、校验、上传；未选平台不会执行
pnpm exec wv upload -p xhs,tt --uv 1.2.3 --desc "同步发布开发版本"

# 本地自动版本：批量只升版一次，所有目标使用同一 Git 提交标题
pnpm exec wv upload -p xhs,tt --mode test --bump patch --git-desc

# 仅检查六个平台的配置和构建输出
pnpm exec wv upload -p all --dry-run

# 确认六套配置和凭据都齐备后，才执行真实六端上传
pnpm exec wv upload -p all

# 也可以批量生成预览
pnpm exec wv preview -p xhs,tt
```

**两个 `all` 含义不同**：`upload -p all` / `preview -p all` 是六个小程序平台；`build -p all --upload` 仍是现有的“小程序 + Web”，等两个构建后端都成功后只上传小程序，不代表六端。`build` 不接受 `-p xhs,tt`，多个小程序目标使用独立 `upload` / `preview` 入口。

批量操作串行执行，重复平台去重；`all` 顺序为微信、支付宝、抖音、小红书、京东、百度。首次失败即停止，已经上传的平台不会回滚。`multiPlatform.targets` 是允许列表，不会自动把 `all` 缩减成该列表；仅配置部分平台时显式传 `-p xhs,tt`。解决失败后只重试未完成的平台，不要误以为整批原子提交。取消命令会停止上传子进程，但不能撤回平台已经接收的版本。

### 结果、进度与本地超时 {#report}

```bash
# stdout 仅输出一个 JSON 报告，构建日志与官方进度进入 stderr
pnpm exec wv upload -p xhs,tt --json --timeout 180 > upload-report.json

# 演练也可生成报告，不调用 SDK、不修改业务版本
pnpm exec wv upload -p all --dry-run --json
```

`--json` 和 `--timeout` 只属于独立 SDK `upload` 命令，不适用于 `build --upload`、`preview` 或 IDE 上传，也不是 `weapp.upload` 配置字段。不加 `--json` 时仍显示日志，并在结束时逐平台汇总。

报告包含 `schemaVersion: 1`、`action: "upload"`、整批 `status`（`success` / `failed`）及按请求顺序排列的 `results`。失败时退出码非零，前序成功结果保留，后续目标为 `not-run`；不会自动重试、回滚或继续上传。参数校验在平台列表解析前失败时，`results` 可以为空。

| 平台条目字段 | 含义 |
| --- | --- |
| `platform` | 已解析的平台；从配置推断且尚未解析时为 `null` |
| `requestedVersion` | 本次请求版本，不等于平台确认的版本；尚未解析时省略 |
| `stage` | 最后进入的阶段：`prepare`、`build`、`validate`、`upload` |
| `status` | `success`、`failed`、`not-run`、`dry-run` 或 `unknown` |
| `result` | 仅成功上传时提供的平台可选信息，可能为 `{}` |
| `error` | 失败原因；整批报告也保留首个错误 |
| `remoteOutcome` | 执行失败时可为 `not-started` 或 `unknown`，不推断远端成功或失败 |

`result` 只选择官方实际返回的字段，不透传 SDK 原始对象：

| 平台 | 可选结果 |
| --- | --- |
| 微信 | `subPackages: { name, size }[]`、`plugins: { appid, version, size }[]`，体积单位为字节；不把内部版本标识当作上传版本 |
| 支付宝 | `sdkVersion`，以及实际返回时的 `qrCodeUrl`；不会主动设置体验版 |
| 抖音 | `previewUrl`、`qrCodeFile` |
| 小红书 | 官方成功返回 `null`，归一化为 `{}` |
| 京东 | `qrCodeUrl`、`qrCodeBase64` |
| 百度 | `previewUrl`（优先默认优化版本链接）、`fileSize`（字节）、`warnings` |

可选字段缺失或无效时省略，不据此否定已完成的上传。预览链接或二维码不代表提审、发布或正式上线。

进度来自官方公开回调：微信显示任务状态／消息，不推算百分比；小红书显示实际百分比；支付宝分别显示日志、任务创建、版本创建事件。其他平台只保留工具日志，不伪造统一百分比。进度事件甚至 `100%` 都不等于完成，仍须等待 SDK 完成确认和正常退出。

`--timeout <秒>` 限制每个平台的 SDK worker 执行时间，**不包含构建**；未指定则不增加超时。接受正数，精度不超过毫秒，最大 `2147483.647` 秒。SDK 执行期间，超时或 `SIGINT` / `SIGTERM` 会触发本地上传进程树清理；无法确认清理完成时保留错误，不改判成功。信号处理只接管 SDK 执行阶段，构建等前置阶段保持原有进程退出行为，不等待未完成的构建，也不保证生成最终报告。

Windows 使用 PowerShell 查询已退出 worker 的子进程归属，单次查询最多等待 30 秒；这是 SDK 执行结束后的本地清理预算，不包含在 `--timeout` 内。查询或终止失败仍然报错，不会跳过清理或自动重试上传。

SDK 开始后超时或中断，条目标为 `unknown` 且 `remoteOutcome: "unknown"`：请求可能已被平台接收，**本地终止不等于远端取消**。其他 SDK 执行错误可为 `failed` 并携带 `remoteOutcome: "unknown"`，同样需要先核实平台后台，再决定是否重试。上传成功也不代表完成提审或正式发布。

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
| 版本参数混用或进入了 IDE 上传                   | SDK 版本使用 `--uv`；顶层 `upload` 的 `--version/-v` 是旧 IDE 标记，不能混入 SDK 选项；工具版本查询使用 `wv --version` |
| 预览没有二维码文件                               | 只有微信写本地图片；其他目标返回二维码 URL 或扫码链接；dry-run 不生成任何预览结果                       |
| SDK 异常退出或未收到完成确认                     | 本次视为失败；检查脱敏错误、平台权限和网络，不要仅凭子进程 exit 0 判断上传成功                          |
| dry-run 成功，真实上传失败                       | dry-run 未校验凭据及官方平台规则，不代表授权、白名单、网络或平台受理成功                                |
| 上传成功，用户看不到正式版本                     | 这里只上传开发版本；还需要在对应平台完成测试、提审与正式发布流程                                        |
| `-p taobao` 无法使用                             | 当前没有淘宝构建/上传适配；不能换成 `-p alipay` 冒充淘宝，见[支持边界](./upload/alipay.md#taobao)       |

真实上传需要有效凭据、平台授权与网络；构建成功、dry-run、平台受理、IDE 编译和真机 Runtime 是不同验收层。最终应使用目标平台的 IDE/真机检查业务功能。完整参数列表见 [CLI 命令参考](./cli.md)。
