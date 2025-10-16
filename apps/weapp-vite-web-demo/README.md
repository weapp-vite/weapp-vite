# weapp-vite Web Demo

一个最小示例，展示如何在浏览器端使用 `@weapp-vite/web` 渲染小程序组件。

## 使用方式

# 运行指令

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| 小程序开发模式 | `pnpm install`<br/>`pnpm --filter weapp-vite-web-demo dev` | 默认仅启动小程序构建与文件监听。首次运行前请在微信开发者工具中开启「服务端口」。 |
| 浏览器开发模式 | `pnpm --filter weapp-vite-web-demo dev:h5` | 内置脚本等价于 `weapp-vite dev -p h5`，可通过 `--` 继续向 Vite 透传参数（例如 `--host 0.0.0.0`）。 |
| 生产构建 | `pnpm --filter weapp-vite-web-demo build` | 生成 `dist/`（小程序）或 `dist-web/`（浏览器，若使用 `-p h5`）等对应产物。 |
| 预览二维码（可选） | `pnpm --filter weapp-vite-web-demo preview` | 调用 `weapp-ide-cli` 生成预览二维码，需要提前配置微信开发者工具 CLI。 |

微信开发者工具：导入仓库内 `project.config.json` 所在目录即可预览小程序效果。

浏览器端：运行 `dev:h5` 后默认访问 <http://127.0.0.1:5173/>，支持在按钮间跳转 About 页验证 `wx.navigateTo` / `wx.navigateBack`、`Page` 生命周期等运行时能力。若需在浏览器中查看二维码或真实设备调试，请确保 Dev Server 监听地址可被局域网访问（参见下方环境变量配置）。

# 环境变量

复制 `.env.example` 为 `.env.local` 或 `.env.development`，按需覆盖以下变量即可定制 Web Dev Server：

| 变量名 | 默认值 | 作用 |
| --- | --- | --- |
| `WEAPP_WEB_HOST` | `127.0.0.1` | 浏览器运行时 Dev Server 监听的主机名（例如设置为 `0.0.0.0` 以供手机访问）。 |
| `WEAPP_WEB_PORT` | `5173` | Dev Server 监听端口。 |
| `WEAPP_WEB_OPEN` | `false` | 设为 `true` 时在启动 Dev Server 后自动打开浏览器。 |

环境变量会在 `vite.config.ts` 中被读取，可按需追加更多自定义配置。

文件结构：

- `src/pages/index/index.wxml`：小程序模板
- `src/pages/index/index.scss`：WXSS 样式（支持 Sass 语法）
- `src/pages/index/index.ts`：页面数据与交互逻辑
- `src/pages/about/index.*`：二级页面，演示 `wx.navigateTo`、`wx.navigateBack`
- `src/app.ts`：小程序应用入口（会触发 Web 侧 `App` 生命周期）
