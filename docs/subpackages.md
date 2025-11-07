# 微信小程序分包最佳实践

本文基于微信官方文档与 `weapp-vite` 现有能力，总结在实际项目中落地分包的关键步骤与配置。建议先通读下列原文，再结合本指南执行：

- [分包加载（概览）](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)：官方能力总览与包体限制。
- [分包加载说明（基础）](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html)：基础分包结构与主包关系。
- [独立分包](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/independent.html)：独立运行上下文的差异与约束。
- [分包预下载](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/preload.html)：通过 `preloadRule` 提前拉取关键分包。
- [分包异步化](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/async.html)：借助异步化降低首包体积与首次渲染开销。

## weapp-vite 的分包能力概览

- 直接读取你维护的 `app.json`，无需额外 DSL。
- 通过 `weapp.subPackages` 为每个分包追加独立编译、依赖裁剪、样式共享、组件自动导入等高级能力。
- `chunks.sharedStrategy` 控制跨包共享模块的输出策略，避免主包/分包体积异常。
- 在 `package.json` 中添加 `\"analyze\": \"weapp-vite analyze\"` 脚本后，执行 `pnpm run analyze` 可生成分包报告，定位共享依赖和重复模块。

## 规划分包的通用原则

- **保持主包最小化**：首屏只保留必要页面与基座逻辑，其余业务模块放入分包。
- **以业务边界拆分**：分包根目录与域名一致，例如 `packages/order`、`packages/profile`，方便团队协作与权限划分。
- **评估独立性**：需要自定义 TabBar、插件能力或明显跨团队交付的模块优先考虑 `independent: true`。
- **同步规划代码共享**：公共工具、样式、国际化资源放在主包或公共目录，由构建器负责复制或抽取。
- **配合运营节奏预下载**：首屏后立即可能访问的分包通过 `preloadRule` 预加载，结合 `network`、`packages` 精细控制。
- **利用异步化能力**：启用 `lazyCodeLoading` 与按需注册组件，让非首屏模块按需拉取。

## 示例：app.json 与 Vite 配置

```jsonc
// src/app.json
{
  "pages": [
    "pages/index/index"
  ],
  "subpackages": [
    {
      "root": "packages/order",
      "name": "订单中心",
      "pages": ["index", "detail"],
      "independent": true,
      "plugins": {
        "pay": { "version": "1.0.0", "provider": "wx1234567890" }
      }
    },
    {
      "root": "packages/profile",
      "pages": ["index", "settings"]
    },
    {
      "root": "packages/marketing",
      "pages": ["poster"],
      "entry": "entry/index"
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "packages": ["packages/profile"],
      "network": "all",
      "timeout": 2000
    }
  },
  "lazyCodeLoading": "requiredComponents",
  "style": "v2",
  "sitemapLocation": "sitemap.json",
  "themeLocation": "theme.json"
}
```

```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    subPackages: {
      'packages/order': {
        independent: true,
        // 只在订单分包保留支付相关依赖
        dependencies: [/^@order\//, 'dayjs'],
        inlineConfig: {
          define: { 'import.meta.env.ORDER_SCOPE': 'true' },
        },
        autoImportComponents: {
          globs: ['packages/order/components/**/*.wxml'],
        },
        styles: [
          // 自动注入公共主题文件
          'styles/theme.scss',
          {
            source: '../shared/styles/components.scss',
            scope: 'components',
            include: ['components/**'],
          },
        ],
      },
      'packages/profile': {
        styles: {
          source: 'styles/index.scss',
          scope: 'pages',
        },
      },
    },
    chunks: {
      sharedStrategy: 'duplicate',
      duplicateWarningBytes: 256 * 1024,
    },
  },
})
```

> 提示：`styles` 支持 `wxss/css/scss/less/stylus` 等格式，`weapp-vite` 会统一转换为目标平台后缀并按作用域注入。

> 自动导入组件：主包与每个分包的 `components/**/*.wxml` 会默认被自动扫描。若分包需独立 Resolver/Typed 输出，可通过 `subPackages.<root>.autoImportComponents` 进一步覆盖；若某个分包不希望自动导入，也可以设置 `subPackages.<root>.autoImportComponents = false`。构建器会在主包与独立构建时分别应用对应配置，保证 `OrderMetrics` 等本地组件无需重复维护 `usingComponents`。

## 运行期体验优化

### 独立分包

- `independent: true` 会让分包运行在独立上下文，无法直接访问主包全局数据。
- 使用 `weapp.subPackages.<root>.dependencies` 精确控制 `miniprogram_npm` 产物，防止主包依赖泄漏到独立分包。
- 通过 `inlineConfig` 为独立分包追加自定义 `define`、插件或按需关闭自动导入。

### 分包预加载

- 在 `app.json` 的 `preloadRule` 中声明触发页、目标分包、网络条件与超时时间。
- 首屏页通常指定为触发页，将次屏高频路径加入 `packages`，并配置 `network: "all"` 以便 Wi-Fi/4G 均可预下载。
- 如需更细粒度控制，可以在页面 `onLoad` 中结合 `wx.preloadSubpackage` 做二次确认。

### 分包异步化

- 启用 `lazyCodeLoading: "requiredComponents"`，避免一次性加载所有自定义组件代码（包含分包组件）。
- 对长链路页面可结合动态组件、`Component` 的 `lifetimes` 中延迟 `require` 的模式，确保同一分包内部也按需执行。
- 在 `weapp-vite` 中使用 `import()` 动态引入模块时，构建器会生成独立 chunk；搭配 `chunks.sharedStrategy` 可避免重复落地。

## 调试与排查清单

- 执行 `pnpm run analyze`（或 `pnpm run analyze -- --report`）查看每个（子）包的产物结构与共享模块。
- 若分包样式缺失，确认 `styles` 定义的文件是否存在，以及 `include` / `exclude` 是否匹配实际路径。
- 关注构建日志中的 `[subpackages]` 警告：它们通常意味着路径超出 `srcRoot`、格式不受支持或重复注册。
- 检查微信开发者工具的包体积面板，确保主包 < 2MB、单个分包 < 2MB，所有分包合计 < 20MB。

## 常见组合策略

- **主包 + 独立支付包 + 通用业务包**：主包保留登录/首页，支付等高敏业务单独独立分包，其余模块按功能拆分普通分包。
- **预加载高频次屏**：在首页 `preloadRule` 指向用户个人页，缩短首次访问个人中心的耗时。
- **共享主题 + 差异化组件**：通过 `styles` 注入统一主题，再结合分包范围内的 `include` 规则定制组件样式。

合理规划分包并结合 `weapp-vite` 的构建能力，可以在保证首屏体验的同时降低维护成本。遇到复杂场景时，优先使用 CLI 分析产物，再针对性调整 `app.json` 与 `vite.config.ts` 配置。
