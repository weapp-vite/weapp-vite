# multi-platform-demo

`weapp-vite` 多平台示例

## 使用方式

### 开发

- `pnpm dev`（默认 weapp）
- `pnpm dev:alipay`
- `pnpm dev:alipay:open`（编译完成后自动打开蚂蚁小程序开发者工具）
- `pnpm dev:tt`
- `pnpm dev:swan`
- `pnpm dev:jd`
- `pnpm dev:xhs`
- `pnpm dev:web`

- `pnpm dev:open` 可以打包并直接启动微信开发者工具

### 构建

`pnpm build`（默认 weapp）

其他平台：

- `pnpm build:alipay`
- `pnpm build:tt`
- `pnpm build:swan`
- `pnpm build:jd`
- `pnpm build:xhs`
- `pnpm build:web`

### 上传

`pnpm upload` 执行 `wv build --upload`，直接复用本次构建，不重复构建。`vite.config.ts` 的 `weapp.upload` 配置默认说明，版本默认取本项目 `package.json.version`；CLI `--uv` / `--desc` 优先。普通构建与开发重建不读取上传参数也不上传，只有显式上传且本次构建、产物校验成功后才调用平台工具：

```bash
pnpm upload -p weapp --dry-run
pnpm upload -p weapp --uv 1.2.3 --desc "更新首页"
pnpm upload -p swan --uv 1.2.3
```

此脚本的 `-p all` 是“小程序 + Web”，不是六端批量上传；等两者都构建成功后只上传小程序。六端批量入口仍是独立的 `pnpm exec wv upload -p all`（可先加 `--dry-run`）。`--watch`、仅 Web 的 `-p web` 不能与上传组合。

上传前需安装目标平台的官方工具，将自己的 AppID 填入 `config/<平台>/` 下的项目配置，并通过环境变量提供凭据。`.env.production.local`、微信私钥路径、支付宝 JSON 身份密钥、各端 Token 和 CI Secrets 的具体步骤见 [上传工具与凭据](https://vite.weapp.dev/guide/cli.html#上传工具与凭据)。`--dry-run` 不校验凭据、不调用 SDK；上传不自动提审或正式上线。

### 打开微信开发者工具

`pnpm open`

### 生成组件/页面

`pnpm g path/to/your/component`

## 文档地址

0. `weapp-vite`: https://vite.weapp.dev/
1. `weapp-tailwindcss`: https://tw.icebreaker.top/
