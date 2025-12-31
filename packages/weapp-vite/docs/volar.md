# Volar 智能提示支持

weapp-vite 集成了 Volar 插件，为 `<json>` 代码块提供完整的智能提示和类型检查。

> **说明：** Volar 插件功能由 `@weapp-vite/volar` 包提供，已作为 weapp-vite 的依赖自动安装，无需单独安装。

## ✨ 功能特性

- ✅ **配置文件智能提示** - 完整的类型检查和自动补全
- ✅ **JSON Schema 支持** - 支持 JSON Schema 验证和自动补全
- ✅ **TypeScript 类型检查** - 利用 TypeScript 类型系统确保配置正确性
- ✅ **自动推断配置类型** - 根据文件路径自动推断是 App/Page/Component 配置
- ✅ **双模式支持** - 支持 JSON 模式和 TypeScript 模式
- ✅ **开箱即用** - 随 weapp-vite 自动安装，无需额外配置

## 🚀 快速开始

### 1. 安装 Volar 扩展

在 VSCode 中安装 [Vue - Official (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 扩展。

### 2. 配置 VSCode（可选）

在项目的 `.vscode/settings.json` 中添加：

```json
{
  "vue.server.hybridMode": true
}
```

### 3. 开始使用

在 Vue 文件中使用 `<json>` 代码块即可获得智能提示：

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

## 📖 使用方式

### 方式一：JSON/JSONC 模式（推荐）

使用 `<json>`（默认 `lang="json"`）或 `<json lang="jsonc">` 获得语法高亮和 Schema 智能提示：

```vue
<json lang="jsonc">
{
  "$schema": "https://vite.icebreaker.top/app.json",
  // 这是注释！jsonc 支持注释
  "pages": ["pages/index/index"],
  "window": {
    "navigationBarTitleText": "我的小程序",
    "navigationBarBackgroundColor": "#ffffff"
  }
}
</json>
```

**特性：**

- ✅ 真正的 JSON 语法高亮
- ✅ JSON Schema 验证和自动补全
- ✅ `$schema` 字段提供智能提示
- ✅ 支持 `jsonc` (JSON with Comments) 可以写注释
- ✅ 自动注入 `$schema`（如果缺失）

### 方式二：JS/TS 模式（动态配置）

使用 `<json lang="js">` 或 `<json lang="ts">` 支持动态配置和异步操作：

```vue
<json lang="ts">
import type { Page } from '@weapp-core/schematics'

export default {
  navigationBarTitleText: '我的页面',
  navigationBarBackgroundColor: '#667eea',
  navigationBarTextStyle: 'white',
} satisfies Page
</json>
```

**特性：**

- ✅ 支持 JavaScript/TypeScript 代码
- ✅ 完整的类型检查和智能提示
- ✅ 支持注释
- ✅ 支持异步函数（async/await）
- ✅ 可以动态生成配置
- ✅ 可以导入其他模块

**异步配置示例：**

```vue
<json lang="ts">
import type { Page } from '@weapp-core/schematics'

// 支持异步函数
export default async () => {
  // 可以从 API 获取配置
  const remoteConfig = await fetch('/api/config').then(r => r.json())

  return {
    navigationBarTitleText: remoteConfig.title,
    navigationBarBackgroundColor: remoteConfig.themeColor,
  } satisfies Page
}
</json>
```

### 方式三：默认模式

不指定 `lang` 时，按 `lang="json"` 处理，并支持注释（JSONC）：

```vue
<json>
{
  "pages": ["pages/index/index"],
  "window": {
    "navigationBarTitleText": "我的小程序"
  }
}
</json>
```

**特性：**

- ✅ JSONC（带注释）语法校验与高亮（默认）
- ✅ JSON Schema 验证与智能提示
- ✅ 自动注入 `$schema`（如果缺失）

## 🎯 配置类型推断

插件会根据文件路径自动推断配置类型：

| 文件路径              | 配置类型  | Schema URL                                   |
| --------------------- | --------- | -------------------------------------------- |
| `app.vue`             | App       | `https://vite.icebreaker.top/app.json`       |
| `pages/**/*.vue`      | Page      | `https://vite.icebreaker.top/page.json`      |
| `components/**/*.vue` | Component | `https://vite.icebreaker.top/component.json` |

## 📊 配置语言模式对比

| 模式           | 语法        | 智能提示       | 异步支持 | 适用场景                   |
| -------------- | ----------- | -------------- | -------- | -------------------------- |
| `lang="json"`  | JSON + 注释 | ✅ Schema      | ❌       | 简单静态配置（可写注释）   |
| `lang="jsonc"` | JSON + 注释 | ✅ Schema      | ❌       | 带注释的静态配置           |
| `lang="json5"` | JSON5       | ✅ Schema      | ❌       | JSON5 语法（如尾逗号等）   |
| `lang="js"`    | JavaScript  | ✅ 类型        | ✅       | 动态配置、简单逻辑         |
| `lang="ts"`    | TypeScript  | ✅ 类型 + 检查 | ✅       | 复杂动态配置、需要类型检查 |
| 无 lang        | JSON + 注释 | ✅ Schema      | ❌       | 默认模式（可写注释）       |

## 📝 完整示例

### App 配置（`app.vue`）

```vue
<script lang="ts">
import { createApp } from 'wevu'

createApp({
  setup() {
    console.log('App launched')
  }
})
</script>

<json lang="jsonc">
{
  "$schema": "https://vite.icebreaker.top/app.json",
  // 页面路径列表
  "pages": [
    "pages/index/index",
    "pages/profile/index"
  ],
  // 全局窗口配置
  "window": {
    "navigationBarTitleText": "我的小程序",
    "navigationBarBackgroundColor": "#667eea",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f7fa"
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
        "pagePath": "pages/profile/index",
        "text": "我的"
      }
    ]
  }
}
</json>
```

### Page 配置（`pages/index/index.vue`）

```vue
<json lang="jsonc">
{
  "$schema": "https://vite.icebreaker.top/page.json",
  // 页面导航栏标题
  "navigationBarTitleText": "首页",
  // 导航栏背景色
  "navigationBarBackgroundColor": "#667eea",
  // 导航栏文字颜色
  "navigationBarTextStyle": "white",
  // 启用下拉刷新
  "enablePullDownRefresh": true
}
</json>
```

### Component 配置（`components/my-card/index.vue`）

```vue
<json>
{
  "$schema": "https://vite.icebreaker.top/component.json",
  "component": true,
  "usingComponents": {}
}
</json>
```

### Page 配置 - TS 模式（`pages/index/index.vue`）

```vue
<script lang="ts">
import { defineComponent, ref } from 'wevu'

defineComponent({
  setup() {
    const count = ref(0)
    return { count }
  }
})
</script>

<json lang="ts">
import type { Page } from '@weapp-core/schematics'

export default {
  navigationBarTitleText: '首页',
  navigationBarBackgroundColor: '#667eea',
  navigationBarTextStyle: 'white',
  enablePullDownRefresh: true,
} satisfies Page
</json>
```

### Page 配置 - 异步 TS 模式（`pages/profile/index.vue`）

```vue
<json lang="ts">
import type { Page } from '@weapp-core/schematics'

// 异步函数动态生成配置
export default async () => {
  // 模拟从 API 获取主题配置
  const themeConfig = await new Promise(resolve => {
    setTimeout(() => {
      resolve({ color: '#667eea', title: '个人中心' })
    }, 100)
  })

  return {
    navigationBarTitleText: themeConfig.title,
    navigationBarBackgroundColor: themeConfig.color,
    navigationBarTextStyle: 'white',
  } satisfies Page
}
</json>
```

## 🎨 智能提示效果

当你输入配置时，VSCode 会显示：

1. **自动补全** - 输入 `window.` 会显示所有可用属性
2. **类型提示** - 显示属性类型和描述
3. **枚举值** - 如 `navigationBarTextStyle` 会显示 `white` | `black`
4. **错误检查** - 配置错误会立即显示波浪线
5. **描述文档** - 悬停显示详细说明

## 🔧 支持的配置属性

### App 配置（`app.json`）

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
- `backgroundTextStyle` - 下拉 loading 样式（`dark` | `light`）
- `enablePullDownRefresh` - 是否开启下拉刷新
- `onReachBottomDistance` - 上拉触底距离

### TabBar 配置

- `color` - tab 文字颜色
- `selectedColor` - tab 选中文字颜色
- `backgroundColor` - tab 背景色
- `borderStyle` - tabbar 边框样式（`black` | `white`）
- `list` - tab 列表（2-5 项）

### Page 配置

- `navigationBarTitleText` - 导航栏标题
- `navigationBarBackgroundColor` - 导航栏背景色
- `navigationBarTextStyle` - 导航栏文字颜色
- `backgroundColor` - 页面背景色
- `enablePullDownRefresh` - 是否开启下拉刷新
- `onReachBottomDistance` - 上拉触底距离

### Component 配置

- `component` - 启用自定义组件
- `usingComponents` - 引用的自定义组件
- `styleIsolation` - 样式隔离模式（`isolated` | `apply-shared` | `shared`）

## ❓ 故障排除

### `<json>` 块没有语法高亮（看起来像纯文本）？

`weapp-vite/volar` 提供的是语言服务能力（Schema/补全/诊断等），但 VSCode 里的“代码染色”通常来自 TextMate 语法注入；默认的 Vue 语法规则可能不会把自定义块 `<json>` 当成 `json/jsonc` 来注入，从而显示为 `plaintext`。

**快速验证：**

1. 运行 `Developer: Inspect Editor Tokens and Scopes`，在 `<json>` 内部查看：
   - 期望 scopes 出现 `source.json.comments`（JSONC）等
   - 如果只看到 `text.html.vue` / `text`，说明缺少语法注入

**解决方案：**

- 推荐：显式标注 `<json lang="jsonc">`（最稳定，立刻获得 JSONC 高亮）
- 可选（本仓库提供）：安装本地高亮扩展 `extensions/vscode`
  1. VSCode → `Developer: Install Extension from Location...`
  2. 选择 `extensions/vscode`
  3. `Developer: Reload Window`

### 智能提示不显示？

1. **确认 Volar 扩展已安装**
   - 在 VSCode 扩展商店搜索 "Vue - Official (Volar)"
   - 确保已安装并启用

2. **重启 TS Server**
   - 按 `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows/Linux)
   - 输入 `TypeScript: Restart TS Server`
   - 按回车执行

3. **检查 tsconfig.json**
   - 确保项目根目录有 `tsconfig.json`
   - 确保 weapp-vite 已正确安装

### 类型错误？

如果遇到类型错误：

1. **清理缓存并重新启动**

   ```bash
   rm -rf node_modules/.vite
   pnpm dev
   ```

2. **重启 VSCode**
   - 完全关闭 VSCode
   - 重新打开项目

### `$schema` 不生效？

1. **确保使用 `<json>`**
2. **检查 `$schema` URL 是否正确**
3. **尝试重启 VSCode**

## 🔗 相关资源

- [weapp-vite 文档](https://github.com/weapp-vite/weapp-vite)
- [Vue 3 文档](https://vuejs.org/)
- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Volar 官方文档](https://vuejs.org/guide/scaling-up/tooling.html#volar)
