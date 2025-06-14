# JSON 配置文件的智能提示

你可以把下方的 `key`/`value` 直接复制到你对应 `json` 配置的第一行，以此来获取编辑器智能提示

> `hover` 行后，点击行最后的按钮来进行复制

## 组件 `component.json`

比如组件的智能提示文件:

```jsonc
"$schema": "https://vite.icebreaker.top/component.json",
```

## 页面 `page.json`

页面的智能提示文件:

```jsonc
"$schema": "https://vite.icebreaker.top/page.json",
```

## 应用 `app.json`

`app.json` 的智能提示文件:

```jsonc
"$schema": "https://vite.icebreaker.top/app.json",
```

## `sitemap.json`

`sitemap.json` 的智能提示文件:

```jsonc
"$schema": "https://vite.icebreaker.top/sitemap.json",
```

## `theme.json`

`theme.json` 的智能提示文件:

```jsonc
"$schema": "https://vite.icebreaker.top/theme.json",
```

这些都是为了给你提供智能提示，它们不会出现在最终的 `dist` 的 `json` 产物中，最终会被剔除，可以放心添加。

另外，通过生成脚手架，生成的产物的 `json` 配置里，都已经带有对应的 `$schema` 字段。

## 效果展示

![vscode-json-intel](/vscode-json-intel.png)