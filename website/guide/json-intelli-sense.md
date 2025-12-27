# JSON 配置文件的智能提示

通过为 `app.json`、`page.json` 等文件添加 `$schema` 字段，VS Code、微信开发者工具等编辑器可以即时给出属性补全、取值提示与错误校验。本页提供现成的 Schema 地址，复制到文件首行即可生效。

> [!TIP]
> 使用 weapp-vite 的脚手架（`pnpm g`）生成的页面/组件，默认已经包含对应的 `$schema`，你只需确认编辑器支持 JSON Schema 即可。工作区已在 `.vscode/settings.json` 里把在线地址映射到本地 `node_modules/@weapp-core/schematics/schemas/*.json`，既保留短链接又支持离线补全。

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

直接复制右侧的地址粘贴即可。如果编辑器支持“悬浮后复制按钮”，也可以将整行复制下来放入文件中。VS Code 用户无需修改 `$schema`，工作区设置会自动将在线地址重定向到本地 Schema 文件。

## 效果展示

![vscode-json-intel](/vscode-json-intel.png)

## 常见问题

- **需要联网吗？** 默认 `$schema` 仍是在线地址，但 VS Code 会把它映射到本地 `node_modules/@weapp-core/schematics/schemas/*.json`，离线也能补全。如果换用其他编辑器，可手动做类似映射或直接改成本地路径。
- **生成器能输出本地 `$schema` 吗？** 可以，通过环境变量 `WEAPP_SCHEMA_BASE=file:///<你的项目绝对路径>/node_modules/@weapp-core/schematics/schemas` 让 `@weapp-core/schematics` 生成时使用本地 Schema（非必需，仅想让文件自带本地路径时启用）。
- **脚手架已生成 `$schema`，但仍没有提示？** 请确认编辑器启用了 JSON Schema 支持：VS Code 需安装官方小程序扩展或开启原生 JSON 支持；微信开发者工具需升级到较新的版本。
- **和 `json.ts` / `json.js` 配合？** 可以。在脚本文件里同样可以导出 `$schema` 字段，weapp-vite 在构建时会一并剥离。
