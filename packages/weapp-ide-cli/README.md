# weapp-ide-cli

`weapp-ide-cli` 是对「微信开发者工具」官方命令行的增强封装，提供更友好的参数体验、路径兼容与配置管理能力，帮助你在本地与持续集成环境中高效调用工具链。

> 开始前请在微信开发者工具中打开「设置 → 安全设置 → 服务端口」。

## 功能亮点

- 自动识别或记忆微信开发者工具 `cli` 所在位置，避免反复输入路径。
- 为 `-p / --project`、`--qr-output` 等选项自动补全绝对路径，默认使用当前工作目录。
- 使用与官方指令完全一致的调用方式，便于在脚本中无缝迁移。
- 支持 macOS、Windows 以及安装了社区版工具的 Linux 桌面环境。

## 安装

```sh
# 使用 pnpm
pnpm add -g weapp-ide-cli

# 或使用 npm
npm install -g weapp-ide-cli

# 或使用 yarn
yarn global add weapp-ide-cli
```

## 快速开始

```sh
# 打开微信开发者工具（项目目录为当前终端所在位置）
weapp open -p

# 启动并加载指定项目
weapp open --project ./dist/dev/mp-weixin

# 执行预览、上传等官方支持的命令
weapp preview
weapp upload --project ./dist/build/mp-weixin
```

`weapp` 与 `weapp-ide-cli` 等价，选择任一前缀即可。

## 常用命令速查

| 命令                                            | 说明                                 |
| ----------------------------------------------- | ------------------------------------ |
| `weapp login`                                   | 在终端扫码登录账号                   |
| `weapp open -p [path]`                          | 启动工具并打开项目（默认为当前路径） |
| `weapp preview --project <path>`                | 生成预览二维码                       |
| `weapp upload --project <path> --version <ver>` | 上传小程序代码                       |
| `weapp quit`                                    | 关闭微信开发者工具                   |

更多原生命令与参数请参考官方文档：<https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html>

## 路径与参数兼容

- `-p` 会被自动替换为 `--project`，并且相对路径会解析为绝对路径。
- `--qr-output`、`--result-output`、`--info-output` 及其短选项在缺省值时会默认指向当前工作目录。
- 如果未显式提供路径参数，CLI 会自动注入当前终端所在目录，方便脚本化调用。

## 配置 CLI 所在位置

执行一次互动式配置即可持久化工具路径：

```sh
weapp config
```

配置数据保存在用户目录：

- macOS / Linux：`~/.weapp-ide-cli/config.json`
- Windows：`C:\Users\<用户名>\.weapp-ide-cli\config.json`

可以直接编辑该文件或重新运行 `weapp config` 来更新路径。当配置文件缺失或留空时，CLI 会尝试按系统默认安装位置自动寻找。

## 平台支持与限制

| 平台            | 支持情况      | 默认查找路径                                               |
| --------------- | ------------- | ---------------------------------------------------------- |
| macOS           | ✅            | `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`   |
| Windows         | ✅            | `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat` |
| Linux（社区版） | ⚠️ 需手动安装 | 通过 `PATH` 搜索 `wechat-devtools-cli`                     |

若所属平台未检测到 CLI，请使用 `weapp config` 指定安装位置。

## 在脚本或 CI 中使用

1. 确保执行环境已安装微信开发者工具并开启服务端口。
2. 首次运行前可通过 `weapp config` 写入 CLI 路径，也可在 CI 中直接向 `~/.weapp-ide-cli/config.json` 写入。
3. 在自动化流程中建议加上 `--qr-output`、`--result-output` 等参数，以便收集产物或日志。

## 常见问题

- **命令执行后无反应**：请确认微信开发者工具已开启服务端口，并尝试重新登录或升级工具版本。
- **提示未找到 CLI**：检查配置文件中的路径是否真实存在，可使用绝对路径避免解析误差。
- **Linux 环境报错**：需安装社区版工具并将 `wechat-devtools-cli` 加入 `PATH`，否则只能手动指定路径。

## 贡献

欢迎通过 Issues 或 Pull Request 提交优化建议，开发前请阅读仓库根目录的 `CONTRIBUTING.md`。

## 许可证

MIT
