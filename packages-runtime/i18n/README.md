# @weapp-vite/i18n

一方维护的微信小程序 i18n 运行时与编译器。它不依赖 Vite、Vue、Wevu、Intlify、i18next 或 messageformat，可以直接用于原生微信小程序。

## 原生小程序

安装运行时并生成 locale catalog：

```bash
pnpm add @weapp-vite/i18n
pnpm exec weapp-i18n compile \
  --src-root miniprogram \
  --default-locale zh-CN \
  --fallback-locale en-US
```

命令扫描 `<src-root>/**/i18n/*.json`，生成 `<src-root>/i18n/locales.js` 与 `locales.wxs`。在项目工具中执行“构建 npm”后，创建应用内实例：

```js
const { createI18n } = require('@weapp-vite/i18n')
const catalog = require('./i18n/locales')

const i18n = createI18n(catalog)

module.exports = i18n
```

Component 和使用 Component 构造的 Page 直接接入 Behavior：

```js
const { I18n } = require('../../i18n')

Component({
  behaviors: [I18n],
})
```

传统 `Page({...})` 使用显式适配器：

```js
const { definePage } = require('../../i18n')

definePage({
  data: {},
})
```

WXML 显式引用生成的 WXS：

```xml
<wxs module="i18n" src="/i18n/locales.wxs" />
<view>{{ i18n.t(__wv_i18n_locale, 'greeting', { user }) }}</view>
```

需要从 `@miniprogram-i18n/core` 渐进迁移时，也可以在 `app.js` 中调用 `initI18n(catalog)`，继续使用模块级 `I18n`、`I18nPage`、`t` 和 locale API。这里是迁移兼容入口，不承诺旧包 select/ICU 消息的无差异兼容；推荐新代码使用 `createI18n()`，避免模块级 singleton 影响测试与实例隔离。

## weapp-vite

使用 `weapp.i18n` 时继续从 `weapp-vite/i18n` 导入当前构建实例。weapp-vite 负责扫描、WXML 改写、分包资产归属、Vite/Rolldown emit 和 HMR；实际运行时与消息编译语义由本包提供。

v1 支持纯文本、fallback、`{name}` 和 `{user.name}` 插值。暂不支持 ICU、plural、select、日期、数字或货币格式化。
