# weapp-vite Web Demo

一个最小示例，展示如何在浏览器端使用 `@weapp-vite/web` 渲染小程序组件。

## 使用方式

```bash
pnpm install
pnpm --filter weapp-vite-web-demo dev    # 启动开发服务器
pnpm --filter weapp-vite-web-demo build  # 构建静态产物
pnpm --filter weapp-vite-web-demo preview
```

访问 `http://localhost:5173/` 后，可以看到从 WXML + WXSS 自动转换而来的 Web Components 页面。

文件结构：

- `src/pages/index/index.wxml`：小程序模板
- `src/pages/index/index.wxss`：WXSS 样式
- `src/pages/index/index.ts`：调用 `defineComponent` 注册自定义元素
- `src/main.ts`：把页面组件挂载到浏览器 DOM
