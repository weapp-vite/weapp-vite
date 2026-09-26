---
title: 京东小程序上传与预览
description: 在 weapp-vite 项目中安装 jd-miniprogram-ci，配置京东代码上传密钥内容与产物目录，串行构建上传开发版本并获取预览二维码图片 URL。
keywords:
  - weapp-vite
  - 京东小程序
  - jd-miniprogram-ci
  - 上传
  - 预览
---

# 京东小程序上传与预览

本页使用 `jd` 目标和官方 `jd-miniprogram-ci`，从已有完整小程序出发：`src/` 内有应用入口、页面和应用配置，并且已经能在目标宿主运行。空目录、组件库和独立插件不适用；项目准备见[开始使用](../upload.md#setup)。

以下配置适合原生小程序。已有框架项目请保留插件和编译配置，只合并本页的平台、源码目录和上传默认值。

## 1. 在应用中安装工具

在小程序应用的 `package.json` 所在目录执行：

```sh
pnpm add -D weapp-vite jd-miniprogram-ci
```

需要局部安装，不能只安装在全局或其他工作区。后续所有命令从这个**源码项目根目录**执行，不进入构建输出目录。

## 2. 配置构建与京东项目

项目根目录的完整 `vite.config.ts`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    platform: 'jd',
    srcRoot: 'src',
    upload: {
      version: '1.2.3',
      desc: '更新首页',
    },
  },
})
```

`weapp.upload` 只给 `build --upload` / `upload` 提供默认参数；普通构建、开发和 HMR 不会自动上传。配置文件代码仍会正常求值，不要在配置加载时执行上传等外部副作用。

在项目根目录创建或修改**源码侧** `project.config.json`，保留已有 IDE 字段。`replace-with-jd-appid` 是占位值，替换成自己的京东小程序 AppID：

```json
{
  "appid": "replace-with-jd-appid",
  "miniprogramRoot": "dist"
}
```

没有启用 `multiPlatform`、也没有设置 `build.outDir` 时：

| 用途                                   | 路径                           |
| -------------------------------------- | ------------------------------ |
| 编译源码                               | `src/`                         |
| 京东项目配置                           | `project.config.json`          |
| 项目配置所在目录                       | 项目根目录 `.`                 |
| `miniprogramRoot` 和本次构建指向的目录 | `dist/`                        |
| 最终传给京东 SDK 的 `projectPath`      | `dist/`，其中必须有 `app.json` |

京东 SDK 不负责解析 IDE 项目配置，所以适配器会先按 `miniprogramRoot` 定位到**真正包含 `app.json` 的代码目录**再调用 SDK。不要把 `miniprogramRoot` 写成 `src`，也不要只填 `srcMiniprogramRoot`。自定义输出目录时，应同时调整源码配置，不能依赖旧 `dist/` 产物。

## 3. 取得密钥内容并配置环境

官方 [jd-miniprogram-ci README](https://unpkg.com/jd-miniprogram-ci@1.0.8/README.md)给出的获取入口是：登录[京东小程序控制台](https://mp-console.jd.com/)，进入“设置 → 开发设置 → 小程序代码上传秘钥”，取得目标小程序的上传密钥。

在项目根目录创建 `.env.production.local`，下面是**占位值**，替换为官方密钥的完整内容：

```dotenv
JD_PRIVATE_KEY="replace-with-complete-jd-upload-key-contents"
```

`JD_PRIVATE_KEY` 传递的是**密钥内容，不是密钥文件路径**。例如 `.keys/jd-upload.key` 这样的字符串会被当成密钥本身，不会自动读取文件；此入口没有 `JD_PRIVATE_KEY_PATH` 参数。不要把其他平台的私钥、业务 Token 或 AppSecret 填到这里。

京东入口没有 AppID 环境变量覆盖项。请在源码侧 `project.config.json` 填好自己的 AppID，并确认密钥确实属于要操作的小程序。

在 `.gitignore` 中加入：

```text
.env.local
.env.*.local
.keys/
```

不要把密钥写入 `weapp.upload`、客户端代码、`src/` 或静态资源目录，也不要使用 `VITE_` 前缀。默认 mode 是 `production`；`--mode test` 对应 `.env.test.local` 等文件，进程环境优先于文件。自定义 `root` / `envDir` 的加载规则见[环境与凭据](../upload.md#environment)。

## 4. dry-run 与显式上传

先验证构建和产物目录：

```sh
pnpm exec wv build --upload -p jd --dry-run
```

这一步不要求真实密钥，也不会加载官方 SDK、校验远端权限或上传代码。成功只证明本次构建及代码目录校验通过，不证明京东接受了版本。

确认密钥和目录后，上传配置中的 `1.2.3` 开发版本：

```sh
pnpm exec wv build --upload -p jd
```

也可以用独立入口覆盖版本、说明，自行完成构建和上传：

```sh
pnpm exec wv upload -p jd --uv 1.2.4 --desc "修复首页展示"
```

这两条真实上传方式二选一。`upload` 不复用旧产物，无需先单独执行 `build`。上传版本取值顺序是 `--uv` → `weapp.upload.version` → `package.json.version`；不要用查询 CLI 版本的 `--version` / `-v`。

成功时 CLI 报告开发版本上传完成，**不自动提审、不正式发布**。京东适配器不额外限制上传版本为三段数字，仍建议使用 `1.2.3`，官方服务会做最终校验。官方 SDK 可能输出二维码相关信息，但需要统一预览结果时应使用下一节的 `preview`，不要把上传完成日志当成预览链接。

## 5. 构建并生成预览

```sh
pnpm exec wv preview -p jd --dry-run
pnpm exec wv preview -p jd
```

第一条不生成二维码；第二条重新构建，使用同一份 `JD_PRIVATE_KEY`，调用官方 preview 接口，而不是开发版本上传接口。

结果是**官方二维码图片 URL**，CLI 以“二维码图片”打印；打开图片后按京东平台要求扫码。它不是本地图片路径或二维码内容字符串，CLI 不自动打开浏览器、不修改剪贴板。官方未返回有效图片地址时会报失败。

`preview` 不使用 `weapp.upload` 的默认值，不要求版本号，也不接受 `--uv`。二维码有效期、扫码者权限及真机可用性由京东决定，构建成功或 dry-run 不能替代目标 IDE/真机验证。

## 6. 京东上传与预览必须跨进程串行

> [!WARNING]
> 官方 `jd-miniprogram-ci@1.0.8` 的上传和预览共用系统临时目录中的 `jd_mini_temp.zip`。两个任务同时运行时可能相互覆盖或删除临时压缩包；两个不同项目也可能冲突。

同一机器上共享临时目录的京东上传、预览必须串行，包括：

- 两个终端分别执行的 `wv upload -p jd` 与 `wv preview -p jd`。
- 不同仓库或工作区中的京东任务。
- CI 多个 job，以及统一命令与直接调用官方 SDK 的任务。

统一 CLI 内部的多目标顺序执行，**不能为另一个 CLI 进程提供跨进程锁**。请在任务调度层设置同机互斥，或使用临时目录真正隔离的独立 runner。不要以为改了产物 `dist/` 路径就隔离了官方临时包；执行期间也不要让 watcher 或其他构建改写同一份产物。

该限制来自官方 SDK 的[打包实现](https://unpkg.com/jd-miniprogram-ci@1.0.8/dist/index.js)，上传、预览共享同一条打包路径。

## 7. 改成 multiPlatform 项目

保留上面的平台、源码目录和上传配置，将 `weapp.multiPlatform` 设为 `{ enabled: true, targets: ['jd'] }`。把源码项目配置移到 `config/jd/project.config.json`，其中 `miniprogramRoot` 仍是 `dist`。

| 用途                                    | 默认路径                        |
| --------------------------------------- | ------------------------------- |
| 需要修改的源码配置                      | `config/jd/project.config.json` |
| 自动复制的 IDE 项目配置                 | `dist/jd/project.config.json`   |
| 项目配置所在目录                        | `dist/jd/`                      |
| 小程序代码目录 / 最终 SDK `projectPath` | `dist/jd/dist/`                 |

构建会把平台配置目录复制到代码产物父目录，不能把密钥放到 `config/jd/`；环境文件继续放在源码项目根目录。不要手工修改生成的 `dist/jd/project.config.json`。上传、预览命令不变，仍明确指定 `-p jd`。

其他端与京东组合时，先阅读[多平台与批量执行](../upload.md#batch)；流水线凭据与同机串行策略见[CI](../upload.md#ci)。

## 常见问题

| 现象                             | 检查方向                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| 无法解析 `jd-miniprogram-ci`     | 在应用项目内局部安装，不要只安装到全局                                             |
| 密钥无效                         | 确认填的是官方上传密钥完整内容，不是文件名、路径或其他平台凭据                     |
| `app.json` 不存在或目录不一致    | 检查源码 `project.config.json` 的 `miniprogramRoot`、`build.outDir` 和完整应用入口 |
| 上传包异常、压缩包丢失或内容不对 | 排查共享系统临时目录的并行京东上传/预览，检查是否有其他构建改写产物                |
| SDK 报目录错误但看似正常退出     | 不以退出码单独判断成功；统一入口要求产物校验及官方调用确实完成                     |
| dry-run 通过而实际上传失败       | 继续检查凭据、网络、官方权限和编译错误；dry-run 不触达这些检查                     |

更多见[统一命令区别](../upload.md#commands)和[通用排错](../upload.md#troubleshooting)。
