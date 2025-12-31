# Volar 插件使用指南

## 快速开始

### 1. 安装依赖

确保项目中已安装以下依赖：

```bash
pnpm add -D @weapp-vite/volar @weapp-core/schematics
```

### 2. 在 Vue 文件中使用

#### 方式一：JSON 模式（推荐）

使用 `<json>` 获得 JSON 语法高亮和 Schema 智能提示：

```vue
<json>
{
  "$schema": "https://vite.icebreaker.top/app.json",
  "pages": [
    "pages/index/index"
  ],
  "window": {
    "navigationBarTitleText": "我的小程序"
  }
}
</json>
```

**提示：** `$schema` 字段会自动获得智能提示，如果忘记添加，插件会尝试自动注入！

#### 方式二：JS/TS 模式

使用 `<json lang="js">` 或 `<json lang="ts">` 获得更严格的类型检查与智能提示：

```vue
<json lang="ts">
import type { App } from '@weapp-core/schematics'

export default {
  pages: ['pages/index/index'],
  window: {
    navigationBarTitleText: '我的小程序',
  },
} satisfies App
</json>
```

### 3. 配置 VSCode

#### 安装 Volar 扩展

在 VSCode 中安装 [Vue - Official (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

#### 项目配置（可选）

在 `.vscode/settings.json` 中添加：

```json
{
  "vue.server.hybridMode": true
}
```

## 智能提示示例

### App 配置

```vue
<json>
{
  "$schema": "https://vite.icebreaker.top/app.json",
  "pages": [
    "pages/index/index",
    "pages/about/index"
  ],
  "entryPagePath": "pages/index/index",
  "window": {
    "navigationBarTitleText": "我的小程序",
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f7fa",
    "enablePullDownRefresh": true
  },
  "tabBar": {
    "color": "#666666",
    "selectedColor": "#667eea",
    "backgroundColor": "#ffffff",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页"
      },
      {
        "pagePath": "pages/about/index",
        "text": "关于"
      }
    ]
  }
}
</json>
```

### Page 配置

```vue
<json>
{
  "$schema": "https://vite.icebreaker.top/page.json",
  "navigationBarTitleText": "页面标题",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white",
  "enablePullDownRefresh": true,
  "onReachBottomDistance": 50
}
</json>
```

### Component 配置

```vue
<json>
{
  "$schema": "https://vite.icebreaker.top/component.json",
  "component": true,
  "usingComponents": {
    "my-button": "/components/my-button/index"
  },
  "styleIsolation": "isolated"
}
</json>
```

## 支持的配置类型

| 文件路径              | 配置类型  | Schema URL                                   |
| --------------------- | --------- | -------------------------------------------- |
| `app.vue`             | App       | `https://vite.icebreaker.top/app.json`       |
| `pages/**/*.vue`      | Page      | `https://vite.icebreaker.top/page.json`      |
| `components/**/*.vue` | Component | `https://vite.icebreaker.top/component.json` |

## 常见属性

### App 配置属性

- `pages` (必填) - 页面路径数组
- `entryPagePath` - 默认启动路径
- `window` - 窗口表现配置
- `tabBar` - 底部标签栏配置
- `style` - 样式版本
- `componentFramework` - 组件框架
- `sitemapLocation` - sitemap 位置

### Window 配置

- `navigationBarTitleText` - 导航栏标题
- `navigationBarBackgroundColor` - 导航栏背景色
- `navigationBarTextStyle` - 导航栏文字颜色（`white` | `black`）
- `backgroundColor` - 窗口背景色
- `enablePullDownRefresh` - 是否开启下拉刷新
- `onReachBottomDistance` - 上拉触底距离

### TabBar 配置

- `color` - tab 文字颜色
- `selectedColor` - tab 选中文字颜色
- `backgroundColor` - tab 背景色
- `borderStyle` - tabbar 边框样式（`black` | `white`）
- `list` - tab 列表（2-5 项）

## 故障排除

### `<json>` 块没有语法高亮

`@weapp-vite/volar` 负责语言服务（Schema/补全/诊断），但 VSCode 的“语法高亮/代码染色”很多时候来自 TextMate 语法注入；默认的 Vue 语法规则可能不会对自定义块 `<json>` 注入 `json/jsonc`。

解决方式：

1. 最推荐：使用 `<json lang="jsonc">` 明确告诉编辑器这是 JSONC。
2. 在本仓库开发时：可安装本地高亮扩展 `extensions/weapp-vite-vue-custom-blocks`（`Developer: Install Extension from Location...` 后重载窗口）。

### 智能提示不显示

1. 确认已安装 [Volar 扩展](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
2. 确认已安装依赖：`pnpm install`
3. 重启 TS Server：`Cmd+Shift+P` -> `TypeScript: Restart TS Server`

### 类型错误

1. 确认 `@weapp-core/schematics` 已安装
2. 清理缓存：`rm -rf node_modules/.vite`
3. 重新构建：`pnpm dev`

### `$schema` 不生效

1. 确保 `$schema` 字段值正确（参考上面的表格）
2. 确保使用 `<json>`
3. 尝试重启 VSCode

## 进阶用法

### 自定义 Schema（可选）

如果你想使用自定义的 JSON Schema，可以指定自己的 `$schema` URL：

```vue
<json>
{
  "$schema": "https://example.com/custom-schema.json",
  "customProperty": "value"
}
</json>
```

### 在项目中统一配置

创建 `types/config.d.ts` 来扩展类型定义（如果需要）：

```typescript
declare module '@weapp-core/schematics' {
  interface App {
    // 扩展 App 类型
    myCustomProperty?: string
  }
}
```

## 相关资源

- [完整文档](./README.md)
- [weapp-vite](https://github.com/weapp-vite/weapp-vite)
- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Volar 官方文档](https://vuejs.org/guide/scaling-up/tooling.html#volar)
