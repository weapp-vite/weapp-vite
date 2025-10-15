# weapp-vite Web Demo

一个最小示例，展示如何在浏览器端使用 `@weapp-vite/web` 渲染小程序组件。

## 使用方式

```bash
pnpm install
pnpm --filter weapp-vite-web-demo dev    # 启动开发服务器
pnpm --filter weapp-vite-web-demo build  # 构建静态产物
pnpm --filter weapp-vite-web-demo preview
```

访问 `http://localhost:5173/` 后，可以看到由 WXML + WXSS 自动转换的页面，并可通过按钮跳转到 About 页验证 `wx.navigateTo` / `wx.navigateBack`、`Page` 生命周期等运行时能力。

文件结构：

- `src/pages/index/index.wxml`：小程序模板
- `src/pages/index/index.scss`：WXSS 样式（支持 Sass 语法）
- `src/pages/index/index.ts`：页面数据与交互逻辑
- `src/pages/about/index.*`：二级页面，演示 `wx.navigateTo`、`wx.navigateBack`
- `src/app.ts`：小程序应用入口（会触发 Web 侧 `App` 生命周期）
