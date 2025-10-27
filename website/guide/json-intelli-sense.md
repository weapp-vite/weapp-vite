# JSON 配置文件的智能提示

通过为 `app.json`、`page.json` 等文件添加 `$schema` 字段，VS Code、微信开发者工具等编辑器可以即时给出属性补全、取值提示与错误校验。本页提供现成的 Schema 地址，复制到文件首行即可生效。

> [!TIP]
> 使用 weapp-vite 的脚手架（`pnpm g`）生成的页面/组件，默认已经包含对应的 `$schema`，你只需确认编辑器支持 JSON Schema 即可。

## 如何添加 `$schema`

在目标配置文件的首行写入对应的 `$schema` 字段即可，例如：

```jsonc
{
  "$schema": "https://vite.icebreaker.top/page.json",
  "navigationBarTitleText": "Home"
}
```

`$schema` 只在编辑器中生效，构建阶段会自动剥离，不会污染最终产物。

## 常用 Schema 列表

| 文件             | `$schema` 地址                                   |
| ---------------- | ----------------------------------------------- |
| 组件 `component.json` | `"https://vite.icebreaker.top/component.json"` |
| 页面 `page.json`      | `"https://vite.icebreaker.top/page.json"`      |
| 应用 `app.json`       | `"https://vite.icebreaker.top/app.json"`       |
| `sitemap.json`        | `"https://vite.icebreaker.top/sitemap.json"`   |
| `theme.json`          | `"https://vite.icebreaker.top/theme.json"`     |

直接复制右侧的地址粘贴即可。如果编辑器支持“悬浮后复制按钮”，也可以将整行复制下来放入文件中。

## 效果展示

![vscode-json-intel](/vscode-json-intel.png)

## 常见问题

- **需要联网吗？** 是的，编辑器会在本地缓存 Schema，但首次加载需要访问上述链接。若处于离线环境，可下载 Schema 文件后改用相对路径。
- **脚手架已生成 `$schema`，但仍没有提示？** 请确认编辑器启用了 JSON Schema 支持：VS Code 需安装官方小程序扩展或开启原生 JSON 支持；微信开发者工具需升级到较新的版本。
- **和 `json.ts` / `json.js` 配合？** 可以。在脚本文件里同样可以导出 `$schema` 字段，weapp-vite 在构建时会一并剥离。
