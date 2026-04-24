# miniprogram-ci 使用说明

本文档说明如何在本仓库里通过 `miniprogram-ci` 以近似 headless 的方式执行微信小程序 `preview` / `upload`。

## 隔离说明

`miniprogram-ci` 不直接安装在本仓库主工作区里，而是隔离在 `tools/miniprogram-ci-runner` 下，避免旧 Babel 依赖污染 monorepo。

对外仍然使用仓库根命令里的 `--version`；隔离 runner 内部为了避开 `cac` 的全局版本开关，改为使用 `--ci-version`，这一层已经由根脚本自动转换，不需要手动处理。

首次使用前先执行：

```bash
pnpm weapp:ci:setup
```

## 适用场景

- macOS / CI 环境下不想依赖微信开发者工具 GUI
- 希望先走 `weapp-vite` 构建，再走官方 CI 上传链路
- 需要把同一套命令复用于多个 `apps/*` / `e2e-apps/*` 项目

## 已提供命令

仓库根目录已内置两个命令：

```bash
pnpm weapp:ci:setup
pnpm weapp:ci:preview -- --project apps/mcp-demo
pnpm weapp:ci:upload -- --project apps/mcp-demo --version 1.0.0 --desc "ci upload"
```

它们会按下面的顺序执行：

1. 读取目标项目下的 `project.config.json`
2. 读取目标项目下的 `package.json`
3. 默认执行 `pnpm --dir <project> run build`
4. 调用 `miniprogram-ci` 执行 `preview` 或 `upload`

## 必要环境变量

至少需要提供上传密钥路径：

```bash
export WEAPP_CI_PRIVATE_KEY_PATH=/abs/path/to/private.key
```

注意：

- `miniprogram-ci` 使用的是微信公众平台下载的 `private.key`
- `AppSecret` 不是 `miniprogram-ci` 的入参，不能替代 `private.key`
- 如果 `AppSecret` 已经泄露，应立即去微信公众平台重置

常用环境变量如下：

```bash
export WEAPP_CI_PROJECT=apps/mcp-demo
export WEAPP_CI_PRIVATE_KEY_PATH=/abs/path/to/private.key
export WEAPP_CI_APPID=wx1234567890abcdef
export WEAPP_CI_ROBOT=1
export WEAPP_CI_VERSION=1.0.0
export WEAPP_CI_DESC="ci upload"
```

说明：

- `WEAPP_CI_APPID` 不传时，默认读取目标项目 `project.config.json` 里的 `appid`
- `WEAPP_CI_VERSION` 不传时，默认读取目标项目 `package.json` 里的 `version`
- `WEAPP_CI_DESC` 不传时，会自动生成默认描述

## Preview 示例

```bash
export WEAPP_CI_PRIVATE_KEY_PATH=/abs/path/to/private.key

pnpm weapp:ci:preview -- --project apps/mcp-demo
```

默认行为：

- 会先构建 `apps/mcp-demo`
- 默认输出二维码到 `.tmp/miniprogram-ci/<project-name>/preview.jpg`
- 默认 `qrcode-format=image`

如果想指定页面、query、二维码输出位置：

```bash
pnpm weapp:ci:preview -- \
  --project apps/mcp-demo \
  --page pages/index/index \
  --query "from=ci" \
  --qrcode-output .tmp/mcp-demo-preview.jpg
```

## Upload 示例

```bash
export WEAPP_CI_PRIVATE_KEY_PATH=/abs/path/to/private.key

pnpm weapp:ci:upload -- \
  --project apps/mcp-demo \
  --version 1.0.0 \
  --desc "ci upload"
```

## 常用参数

```bash
--project <path>
--private-key <path>
--appid <appid>
--robot <1-30>
--version <value>
--desc <text>
--page <path>
--query <text>
--scene <number>
--qrcode-format <terminal|image|base64>
--qrcode-output <path>
--source-map-save-path <path>
--skip-build
```

## GitHub Actions 示例

```yaml
- name: Install
  run: pnpm install --config.confirmModulesPurge=false

- name: Upload Mini Program
  env:
    WEAPP_CI_PRIVATE_KEY_PATH: ${{ github.workspace }}/.tmp/weapp-ci/private.key
  run: |
    mkdir -p .tmp/weapp-ci
    printf '%s' "${{ secrets.WEAPP_CI_PRIVATE_KEY }}" > .tmp/weapp-ci/private.key
    pnpm weapp:ci:upload -- --project apps/mcp-demo --version "${{ github.sha }}" --desc "github actions upload"
```

注意：

- 不要把 `private.key` 提交进仓库
- `private.key` 建议通过 CI secret 动态写入临时目录
- 当前脚本默认会先构建目标 app；如果上一步已经单独构建过，可追加 `--skip-build`

## 故障排查

- 报 `缺少 --private-key`：
  说明没有传 `--private-key`，也没有设置 `WEAPP_CI_PRIVATE_KEY_PATH`
- 报 `未拿到合法 appid`：
  说明目标项目里的 `project.config.json` 没有真实 AppID，或你需要用 `--appid` / `WEAPP_CI_APPID` 覆盖
- 报 `目标项目构建失败`：
  先单独执行 `pnpm --dir <project> run build` 看构建日志
- 报 `preview/upload` 失败：
  优先检查 `private.key`、机器人编号、AppID 是否匹配同一个小程序
