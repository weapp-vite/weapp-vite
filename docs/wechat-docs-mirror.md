# 微信小程序文档镜像

微信小程序官方文档镜像已迁移到独立仓库：

- `https://github.com/sonofmagic/wechat-miniprogram-docs-mirror`

本仓库仅保留抓取脚本：

```bash
pnpm docs:wechat:mirror
pnpm docs:wechat:mirror -- --max-pages 20
pnpm docs:wechat:mirror -- --no-assets
pnpm docs:wechat:mirror -- --output /absolute/path/to/wechat-miniprogram-docs-mirror/framework
```

默认输出目录：

- `.tmp/wechat-docs-mirror/framework`
