---
title: 百度智能小程序上传与预览
description: 配置 swan-toolkit 登录密钥 BDUSS、最低基础库版本与 project.swan.json，使用 weapp-vite 构建上传普通小程序开发版本并获取预览链接。
keywords:
  - weapp-vite
  - 百度智能小程序
  - swan-toolkit
  - BDUSS
  - 上传
  - 预览
---

# 百度智能小程序上传与预览

本页使用 `swan` 目标和官方 `swan-toolkit`。需要一个已经能运行的**普通完整小程序**：源码放在 `src/`，有应用入口、页面及应用配置。此入口不发布插件、动态库或扩展，也不适用于组件库和空目录。项目准备见[开始使用](../upload.md#setup)。

下例面向原生小程序；已有框架应用请保留其插件和编译配置，仅合并本页所需字段。

`test` / `production`、不同 AppID 与自动版本/提交说明见[多环境上传](./environments.md)。

## 1. 在应用中安装工具

在小程序应用的 `package.json` 所在目录局部安装：

```sh
pnpm add -D weapp-vite swan-toolkit
```

只在全局安装 `swan` 不足以供统一入口解析。后续命令均在这个**源码项目根目录**执行，不进入 `dist/`。官方工具的安装与编译资源需按其要求准备，入口见[百度小程序 CLI 文档](https://smartprogram.baidu.com/docs/develop/devtools/smartapp_cli_function/)。

## 2. 配置构建与百度项目

项目根目录的完整 `vite.config.ts`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'swan',
    srcRoot: 'src',
  },
})
```

无需配置 `weapp.upload`：上传版本默认读取业务 `package.json.version`，说明按包名与最终版本自动生成 `name@version`；版本不会自动递增。仅需固定覆盖时才设置 `weapp.upload`，临时覆盖可用下文 CLI 参数。

`weapp.upload` 只提供 `build --upload` / `upload` 的默认值，普通 `build`、`dev` 和 HMR 不会自动上传。配置文件代码仍正常求值，不要把上传或其他外部副作用放在配置加载过程中。

在项目根目录创建或修改**源码侧** `project.swan.json`。保留已有 IDE 配置，下面展示本例所需字段；`replace-with-swan-appid` 是占位值，替换为自己的百度小程序 AppID：

```json
{
  "appid": "replace-with-swan-appid",
  "smartProgramRoot": "dist",
  "compileType": "miniprogram",
  "developType": "normal"
}
```

注意使用小写 `appid`，不能只写 `appId`。百度入口会要求生成项目配置中的 `appid` 与解析出的 AppID 一致；没有 AppID 环境变量覆盖项。

没有启用 `multiPlatform`、也没有自定义 `build.outDir` 时：

| 用途                              | 路径                |
| --------------------------------- | ------------------- |
| 编译源码                          | `src/`              |
| 百度项目配置                      | `project.swan.json` |
| 官方 CLI 的项目目录               | 项目根目录 `.`      |
| `smartProgramRoot` 指向的代码目录 | `dist/`             |
| 本次构建的应用配置                | `dist/app.json`     |

百度上传校验读取的是 **`smartProgramRoot`**，不能只用 `miniprogramRoot` 或 `srcMiniprogramRoot` 代替。它必须指向本次实际输出，而不是 `src/`。如果设置 `build.outDir`，须同步调整源码项目配置。

`developType: 'normal'` 表示普通小程序。不要为了绕过限制将插件、动态库或扩展伪装成 `normal`；这些类型不在统一上传/预览范围内。

## 3. 获取登录密钥并选择最低基础库

### 登录密钥是 BDUSS，不是应用 access token

按[官方 CLI 文档的“登录密钥说明”](https://smartprogram.baidu.com/docs/develop/devtools/smartapp_cli_function/)操作：

1. 使用有目标小程序操作权限的账号登录百度智能小程序开发者工具。
2. 官方文档要求开发者工具版本高于 `2.4.1`，登录后通过“菜单 → 关于 → 复制登录密钥”获取用于 CLI 的登录密钥。
3. 将该密钥内容保存到下文的 `SWAN_UPLOAD_TOKEN`，不是保存一个文件路径，也不是填业务 API 的 access token。

本入口将此值作为官方 CLI 的 `--token` 传入，其认证分支按 **BDUSS** 使用。`swan login` 的本地登录状态不替代必填的 `SWAN_UPLOAD_TOKEN`，也不要把工具内部缓存的 Bearer Token 当作 BDUSS。

这是个人账号登录凭据。官方建议公共流水线使用独立开发账号，做好用户隔离和安全保护。不要从不可信脚本、第三方服务或共享日志中传递它。

### 最低基础库与上传版本是两个字段

`SWAN_MIN_VERSION` 对上传和预览都必填，表示项目所需的**最低基础库版本**，不是 `weapp.upload.version` 或 `--uv` 的应用版本。

依据项目调用的 API/组件能力以及百度当前支持的版本选择值，参考[官方兼容性与最低基础库说明](https://smartprogram.baidu.com/docs/develop/swan/compatibility/)。官方工具会校验平台可用的基础库版本，不能随意编造，也不会由 `weapp-vite` 自动推断。

在项目根目录创建 `.env.production.local`：

```dotenv
# 以下密钥是占位值，请替换为自己的官方 CLI 登录密钥内容
SWAN_UPLOAD_TOKEN=replace-with-official-cli-bduss
# 3.100.0 仅作格式示例，请按项目需要和平台当前支持的版本替换
SWAN_MIN_VERSION=3.100.0
```

在 `.gitignore` 中加入：

```text
.env.local
.env.*.local
.keys/
```

不要把这些凭据写进客户端代码、`weapp.upload`、`src/`、静态资源或平台配置目录，不要添加 `VITE_` 前缀。默认 mode 是 `production`；`--mode test` 使用 `.env.test.local` 等文件，进程环境优先。自定义 `root` / `envDir` 及更多规则见[环境与凭据](../upload.md#environment)。

> [!WARNING]
> 官方 CLI 通过 `--token` 接收 BDUSS，因此即使你只在 `.env` 或 CI Secrets 中提供它，运行时仍会出现在官方子进程参数中。同机有权限的用户可能读取这些参数。日志脱敏不等于进程参数不可见；请使用可信、隔离的 runner，任务结束后销毁其环境，不要在不可信共享主机上运行。

## 4. dry-run 与显式上传

先验证构建和代码目录：

```sh
pnpm exec wv build --upload -p swan --dry-run
```

此时不要求真实 BDUSS 或最低基础库环境变量，不加载官方 CLI，不验证平台权限、基础库有效性或远端编译结果，也不会上传。成功不等于百度接受了该版本。

凭据与最低基础库就绪后，使用业务包版本和自动说明上传开发版本：

```sh
pnpm exec wv build --upload -p swan
```

需要一次性覆盖版本和说明时，也可以选择独立入口自行构建后上传：

```sh
pnpm exec wv upload -p swan --uv 1.2.4 --desc "修复首页展示"
```

两种方式二选一即可，独立 `upload` 不需要预先再执行一次 `build`。上传版本优先级为 `--uv` → `weapp.upload.version` → `package.json.version`；查询 CLI 版本的 `--version` / `-v` 不能替代 `--uv`。

百度上传版本必须由 **2 至 4 段数字**组成，例如 `1.0`、`1.2.3`、`1.2.3.4`；`1`、`1.2.3-beta.1` 不合法。这条规则与最低基础库版本的有效列表无关。

成功时 CLI 报告开发版本上传完成。统一入口只处理普通小程序，**不自动提审、不正式发布**；不能把官方日志中的“发布”字样理解为本命令已完成正式上线。

## 5. 构建并生成预览链接

```sh
pnpm exec wv preview -p swan --dry-run
pnpm exec wv preview -p swan
```

第一条不生成预览码；第二条重新构建并调用官方 preview 接口，仍然需要 `SWAN_UPLOAD_TOKEN` 与 `SWAN_MIN_VERSION`。

结果是**官方扫码目标 / 预览链接**，CLI 以“预览链接”打印。它是二维码内容，不是二维码图片 URL，也不是本地图片文件。可按平台要求将该扫码目标用于二维码展示并用百度宿主验证；不要直接当作图片地址使用。若官方同时返回低版本与默认基础库两个预览码，统一入口返回默认版本的预览链接。

`preview` 不使用 `weapp.upload` 默认值，不要求应用上传版本，也不接受 `--uv`。它不会调用开发版本上传、提审或正式发布，CLI 不自动打开浏览器或修改剪贴板。二维码有效期、扫码者权限与宿主可用性由百度决定；构建成功不能代替真机验收。

## 6. 改成 multiPlatform 项目

推荐将 `weapp.multiPlatform` 设为 `{ projectConfigs: { swan: { appid: 'replace-with-swan-appid', developType: 'normal' } } }`，其他平台放入同一映射，公共字段用对象展开。不需要新增 `config/swan/project.swan.json`；完整配置和 test/production 见[统一配置](../upload.md#batch)与[环境指南](./environments.md#appid)。

默认生成 `dist/swan/dist/project.swan.json`，与 `app.json` 同级；官方 CLI 项目目录为 `dist/swan/dist`，`smartProgramRoot` 自动为 `.`。不要在输入中填写代码根字段，也不要修改生成 JSON；自定义目录使用 `build.outDir`。凭据仍留在源码项目根的环境文件或 CI Secrets，不写入映射。

原生文件方式仍可使用 `{ projectConfigRoot: 'config', targets: ['swan'] }`：配置放在 `config/swan/project.swan.json`，`smartProgramRoot` 为 `dist`，CLI 项目目录为 `dist/swan`，代码在 `dist/swan/dist`。不能与 `projectConfigs` 同时使用。命令继续显式传 `-p swan`，安全注入见[CI](../upload.md#ci)。

## 常见问题

| 现象                                   | 检查方向                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| 无法解析 `swan` / `swan-toolkit`       | 在实际应用中局部安装 `swan-toolkit`，并完成官方工具所需资源准备                          |
| 已登录工具但仍缺少 Token               | 统一入口仍要求 `SWAN_UPLOAD_TOKEN`，填官方登录密钥 BDUSS，不是本地 Bearer 缓存或文件路径 |
| 登录过期或无权限                       | 用有目标 AppID 权限的账号重新获取密钥；统一入口采用 JSON 模式，不会交互询问登录          |
| 缺少 `SWAN_MIN_VERSION` 或基础库不合法 | 上传和预览都须明确配置平台支持的最低基础库，不要拿应用版本替代                           |
| 上传版本格式不合法                     | 用 2 至 4 段数字，移除预发布后缀                                                         |
| `appid` 不一致                         | 在源码 `project.swan.json` 使用小写 `appid`，修改后重新构建                              |
| 提示不支持项目类型                     | 确认实际为普通小程序，`developType` 为 `normal`；插件等应走对应官方流程                  |
| 代码目录不一致 / 无 `app.json`         | 检查 `smartProgramRoot`、`build.outDir` 与完整应用入口                                   |
| 将预览链接作为图片加载失败             | 返回值是扫码目标，不是图片 URL，按二维码内容使用                                         |

更多见[统一命令区别](../upload.md#commands)和[通用排错](../upload.md#troubleshooting)。
