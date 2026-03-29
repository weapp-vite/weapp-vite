# 微信小程序官方文档镜像

这个目录用于维护微信小程序官方开发文档的本地镜像。

当前已接入的入口：

- `framework`: `https://developers.weixin.qq.com/miniprogram/dev/framework/`

更新方式：

```bash
pnpm docs:wechat:mirror
```

常用参数：

```bash
pnpm docs:wechat:mirror -- --max-pages 20
pnpm docs:wechat:mirror -- --no-assets
pnpm docs:wechat:mirror -- --output ./docs/wechat-miniprogram/framework
```

产物说明：

- `framework/**/*.md`: 抓取并转换后的 Markdown 页面
- `framework/_assets/*`: 页面中引用到的本地资源
- `framework/manifest.json`: 抓取清单与页面索引
- `framework/CATALOG.md`: 页面目录
