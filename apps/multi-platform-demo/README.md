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

`vite.config.ts` 的 `weapp.upload` 配置默认说明，版本默认取本项目 `package.json.version`。配置不会让普通构建或开发重建自动上传；仅显式执行以下命令，在本次构建和产物校验成功后才上传：

```bash
pnpm upload -p weapp
pnpm upload -p jd,swan --uv 1.2.3 --desc "更新首页"
pnpm upload -p all --dry-run
```

上传前需安装目标平台的官方工具并通过环境变量提供凭据，见 [上传配置与凭据](https://vite.weapp.dev/guide/cli.html#upload-构建并上传六端小程序)。`--dry-run` 不调用上传服务；上传不自动提审或正式上线。

### 打开微信开发者工具

`pnpm open`

### 生成组件/页面

`pnpm g path/to/your/component`

## 文档地址

0. `weapp-vite`: https://vite.weapp.dev/
1. `weapp-tailwindcss`: https://tw.icebreaker.top/
