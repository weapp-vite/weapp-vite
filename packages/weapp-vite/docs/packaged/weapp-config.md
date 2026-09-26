# Weapp Config

## 入口位置

`weapp-vite` 的小程序配置通常放在：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
  },
})
```

## 高频配置项

### `srcRoot`

源码根目录。排查输出缺页、找不到入口、自动路由异常时先确认它。

### `autoRoutes`

适合希望用约定生成页面路由的项目。启用后要保持 pages 目录与输出约定稳定。

### `multiPlatform.projectConfigs`

在一份配置中按 `weapp` / `alipay` / `tt` / `xhs` / `jd` / `swan` 提供原生项目字段，公共项用普通对象展开。没有显式 `targets` 时从映射键推导；完整示例见[上传速查](./upload.md#多平台与输出校验)。

标准项目 JSON 由打包器原生生成在代码目录内，默认 `dist/<平台>/dist/`，与 `app.json` 同级。SDK 代码根为 `.`；输入不能填写 `miniprogramRoot`、`srcMiniprogramRoot`、`smartProgramRoot`，修改目录用 `build.outDir`。这里只管理 IDE/SDK 项目配置，不代替业务 `app.json`。

不读取源码侧原生项目 JSON 或私有 JSON；缺少选中平台时直接报错，不回退到旧文件。不能同时指定 `projectConfigRoot` 或 `enabled: false`。独立插件仍使用原生文件模式；Web/组件库不生成项目 JSON。不写映射时保留原生文件模式。凭据始终走环境变量，不写入映射。

### `upload`

`weapp.upload: { version?: string; desc?: string }` 只设置显式 `wv build --upload` 和独立 `wv upload` 的默认参数，不是自动上传开关，也不支持凭据字段。版本优先级为 `--uv` > `weapp.upload.version` > `package.json.version`；说明优先级为 `--desc` > `weapp.upload.desc` > 项目名称与最终版本。值会去除首尾空白，显式空版本报错，空说明使用自动生成的说明。

普通 `build`、`dev/HMR` 不使用这组上传默认参数也不上传，`preview` 不使用该配置。配置文件本身仍会正常加载与合并，不保证其中的 JavaScript getter 延迟求值。`wv build --upload` 复用本次构建，等待所有选中的构建后端成功、产物校验通过后才调用平台工具；`wv build --upload --dry-run` 不校验凭据、不调用 SDK。

`build` 上的 `--uv`、`--desc`、`--dry-run` 必须与 `--upload` 一起使用；`--watch --upload`、仅 Web 的 `-p web --upload` 会报错。`build -p all --upload` 是“小程序 + Web”，两者都构建成功后只上传小程序；独立 `upload -p all` 则保持六端逐一构建上传。

CI 可在测试通过后显式执行 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`。凭据仍通过环境变量提供；先读本地[上传与预览速查](./upload.md)，完整的 AppID、私钥、支付宝 JSON 身份密钥、各端 Token、环境文件和 CI Secrets 示例见[分平台操作指南](https://vite.weapp.dev/guide/upload.html)。

### `buildScope`

用于只构建主包和指定分包。常用在大项目里只调试某几个业务分包：

```bash
wv dev --scope main,packages/order
wv build --scope packages/order
```

也可以写在配置里：

```ts
export default defineConfig({
  weapp: {
    buildScope: {
      includeMainPackage: true,
      include: ['packages/order'],
    },
  },
})
```

`main` 表示主包，`packages/order` 匹配 `app.json.subPackages[].root`。启用后，产物 `app.json.subPackages` 只保留参与 scope 的分包，`preloadRule`、`tabBar`、`entryPagePath`、自动路由和 typed router 也会按同一注册图裁剪。`preloadRule.packages` 支持分包 `root`、`name` 和主包标记 `__APP__`；`tabBar.list` 不足微信要求的 2 项时会删除整个 `tabBar`。发布前建议再跑不带 scope 的完整构建。

### `chunks.preserveModules`

按 `srcRoot` 相对路径匹配源码模块，并为命中的模块保留独立输出文件和目录边界：

```ts
export default defineConfig({
  weapp: {
    chunks: {
      preserveModules: ['utils/**', 'services/**'],
    },
  },
})
```

例如 `src/utils/request.ts` 会输出到 `utils/request.js`，引用方会保留对该文件的引用；barrel 模块的静态依赖也会保持独立。该配置用于调试定位和产物审计，不保证减少总包体积或提升冷启动；构建会自动选择兼容的 entry signature。

例如一个已经手动分包、包含大量 `utils` 和 `services` 模块的原生项目，可以这样配置：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    chunks: {
      preserveModules: [
        'utils/**',
        'services/**',
      ],
    },
  },
})
```

规则相对于 `srcRoot`，因此不要添加 `src/` 前缀。构建后，已进入依赖图的 `src/utils/request.ts` 和 `src/services/user.ts` 会分别输出为 `utils/request.js` 和 `services/user.js`；页面保留对这些文件的引用。CJS 和 ESM 均支持该配置。

`preserveModules` 保留的是构建后的文件和目录边界。源码仍会经过模块解析、TypeScript 转换并由构建器写入，不会被原样复制；未被入口引用的文件也不会仅因匹配规则而输出。如果只需要改变共享模块的输出位置，不要求单次引用模块保持独立，请使用 `chunks.sharedMode: 'path'`。

需要保留 `srcRoot` 下所有已引用源码模块时，使用 `**`：

```ts
export default defineConfig({
  weapp: {
    srcRoot: 'src',
    chunks: {
      preserveModules: ['**'],
    },
  },
})
```

`**` 同时匹配 `src/helper.ts` 这样的顶层模块和 `src/utils/request.ts` 这样的嵌套模块。不要使用 `*/**` 代替，因为它不会匹配 `srcRoot` 顶层文件。该配置已通过 CJS、ESM 构建回归，顶层模块和嵌套模块都会按相对路径生成独立文件，引用方保留对应文件引用。

页面、组件等逻辑入口仍走各自的入口构建流程，`srcRoot` 外部依赖和未引用文件不会被强制输出。全量保留会增加文件数量，建议结合 `wv analyze` 检查实际包体积；只需要固定目录时优先使用更具体的 glob。

### 分包异步模块

跨分包 JS 使用微信官方 callback 或 Promise API：

```ts
require('../../packages/order/modules/price', onLoaded, onError)
const moduleExport = await require.async('../../packages/order/modules/price')
```

`weapp-vite` 会把 callback 写法规范化为 `void require.async(path).then(onLoaded, onError)`，并确保静态路径目标作为异步 chunk 输出，避免被当成同步 CommonJS 依赖提升到主包。源码路径带 `.ts` 等扩展名时，调用参数会同步改为实际 `.js` 产物路径。路径必须是静态相对字面量，目标 root 也必须存在于最终 `app.json.subPackages`；使用自动路由的自定义 root 时，同时声明 `weapp.subPackages.<root>`。

希望保留标准 `import()` 写法时，可以选择微信原生分包模式：

```ts
export default defineConfig({
  weapp: {
    chunks: {
      dynamicImports: 'native',
    },
  },
})

const moduleExport = await import('../../packages/order/modules/price.ts')
```

`native` 只转换微信构建中跨入已声明普通分包的静态相对导入，并将路径规范化为 `.js`。动态表达式、裸模块、同包导入、独立分包目标以及非微信构建继续保留 bundler 动态导入。默认的 `preserve` 不做转换；历史 `inline` 已废弃，当前会回退为 `preserve` 并输出一次警告。

跨包自定义组件不走这套 JS API。组件继续使用 `usingComponents` 与 `componentPlaceholder`，由微信基础库负责下载后的占位替换。

### `autoImportComponents`

适合用目录扫描自动注册组件的项目。组件重名时要先解决命名冲突，不要让自动引入规则长期处于歧义状态。

### `i18n`

微信项目可以通过 `weapp.i18n` 启用由 `@weapp-vite/i18n` 提供核心语义的 locale 编译与运行时切换：

```ts
export default defineConfig({
  weapp: {
    i18n: {
      defaultLocale: 'zh-CN',
      fallbackLocale: 'en-US',
    },
  },
})
```

默认扫描 `**/i18n/*.json`。Component Page、传统 Page、分包实例边界、原生无 Vite 用法和 v1 占位符限制见 `i18n.md`。

### `styles`

用于生成主包独立样式入口，并按规则向主包与普通分包的样式注入相对 `@import`。默认不会修改 `app.wxss`；对象配置的 `include` 显式匹配 `app.vue` 等应用入口时，可以向 `app.wxss` 注入：

```ts
export default defineConfig({
  weapp: {
    styles: [
      {
        source: 'styles/theme.scss',
        include: ['pages/**', 'components/**', 'packages/*/**'],
      },
      {
        source: 'styles/manual.less',
        inject: false,
      },
      {
        source: 'styles/app-theme.scss',
        include: 'app.vue',
      },
    ],
  },
})
```

`inject: false` 只生成目标平台样式文件，适合由源码手动 `@import`。未显式配置 `include` 时仍默认排除 app，避免意外把共享样式提升为全局样式。独立分包不能依赖主包资源，不会收到 `weapp.styles` 的自动注入；需要在 `weapp.subPackages.<root>.styles` 中声明分包自己的入口。

### `compilerPlugins`

`compilerPlugins` 是底层源码编译器的扩展入口。第三方 provider 可以声明自己接管的源码，并参与 CSS、WXML、JavaScript、bundle 和 HMR 生命周期：

```ts
import type { WeappCompilerPlugin } from 'weapp-vite/config'
import { defineConfig } from 'weapp-vite/config'

const compilerPlugin: WeappCompilerPlugin = {
  name: 'example-compiler',
  capabilities: { style: true, template: true, script: true, hmr: true },
  create() {
    return {
      claimSource: ({ id }) => id.endsWith('.css'),
      transformCss: ({ code }) => ({ code }),
    }
  },
}

export default defineConfig({
  weapp: {
    compilerPlugins: [compilerPlugin],
  },
})
```

provider 的状态由 provider 自己维护，host 负责插件顺序、源码所有权冲突、依赖监听和产物生命周期。`weapp.tailwindcss` 仍然是内置 Tailwind adapter 的兼容门面；UnoCSS 等实现可以独立包的形式提供同一协议。

### `tailwindcss`

内置的 `weapp-tailwindcss` 集成支持显式配置和 Tailwind CSS v4 自动检测。显式配置优先级最高：设置为 `false` 会完全关闭（包括自动检测），设置为 `true` 或对象会按显式选项启用。未配置时，项目解析到 Tailwind CSS v4 且 CSS 模块实际包含 `@import "tailwindcss"`（也支持 `source(...)` 等合法参数）才会自动启用；Tailwind CSS v3、未安装或未引入该模块时不会生成 Tailwind CSS。

启用后，`weapp-vite` 使用 `weapp-tailwindcss@5.5.2` 的 `core` compiler 处理 WXSS、WXML 和 JavaScript，通过 `compiler.generate()` 生成 Tailwind CSS，并将结果写入正常的样式产物。WXSS 最终化由 core 统一完成，Tailwind 构建阶段的 `@plugin`、`@source` 等指令不会泄漏到小程序产物：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    tailwindcss: {
      cssEntries: ['src/app.css'],
      rem2rpx: true,
      compiler: {
        maxRoots: 32,
        onRootEvicted(id) {
          console.log('Tailwind root evicted:', id)
        },
      },
    },
  },
})
```

也可以直接写 `tailwindcss: true`，此时默认使用 `src/app.css` 作为入口。入口文件仍必须被项目实际引入，例如在 `app.vue` 中使用 `<style src="./app.css"></style>`；`cssEntries` 只声明 compiler 的入口集合，不能替代模块图导入。

`tailwindcss` 对象会透传 `weapp-tailwindcss/core` 支持的 options。`compiler.maxRoots` 用于限制长期 watch 中保留的 root 数量，`compiler.onRootEvicted` 会在 root 被淘汰时收到对应 id。HMR 会把真实变更文件交给 compiler，由 compiler 根据 `@source` glob 精确失效关联 root。

一次构建只应使用这一套内置集成，不要再额外注册 `WeappTailwindcss()` Vite 插件。`weapp-vite@6.24.0` 起，preflight 会移除所有 `weapp-tailwindcss:*` 外部插件并输出一次中文迁移警告；请删除对应的 import 和 `plugins` 注册代码。

### `routeRules`

用于给页面路由追加规则，例如 layout、微信分包预下载等。它属于项目级编排，而不是组件内部语义。

```ts
export default defineConfig({
  weapp: {
    routeRules: {
      'pages/home/**': {
        preload: {
          packages: ['packages/order'],
          network: 'wifi',
        },
      },
    },
  },
})
```

微信构建会把 `preload` 合成为 `app.json.preloadRule`；手写的同一路由规则优先，其他平台不会生成微信专属字段。多条 glob 命中时选择具体程度最高的一条。需要检查静态跨分包跳转时，运行 `wv analyze --preload`；它只输出建议，不修改源码，并按触发页所属包汇总实际分包体积与共享的 2 MB 额度。

### `vue.template.htmlTagToWxml`

适合从 Web/Vue 模板迁移到小程序 `.vue` 的项目。开启后，会把常见 HTML 标签映射成小程序内置标签，例如 `div -> view`、`span -> text`、`img -> image`、`a -> navigator`，也包含 `br/hr` 这类容易在迁移时“消失”的标签。

### `vue.template.htmlTagToWxmlTagClass`

默认开启。仅当 `htmlTagToWxml` 发生标签映射时，为输出节点追加原标签名 class，例如 `h3 -> <view class="h3">`、`br -> <view class="br" />`。

如果你的迁移策略是“先跑通，再用 CSS 逐步恢复默认外观”，这个开关很有价值；如果不希望产物里自动带这层语义 class，可以显式设为 `false`。

### `vue.template.formatWxml`

控制 `.vue` / JSX 编译生成的 WXML 是否格式化。默认 `auto`：开发态开启，生产构建关闭。显式设为 `true` 可始终输出带缩进和换行的 WXML，显式设为 `false` 可始终保持紧凑输出。

格式化只处理标签层级缩进，含文本内容的元素会保持单行，避免重排文本空白语义。

### `vue.template.slotFallbackWrapper`

用于配置普通具名插槽 fallback 的真实 wrapper。微信平台默认使用内部 `virtualHost` 组件；需要回到旧版 `view` 行为时，可配置 `vue.template.slotFallbackWrapperStrategy: 'view'` 或显式 `slotFallbackWrapper: 'view'`。

当组件把自己的默认 `<slot />` 继续透传到子组件的具名插槽时，编译器不能生成 `<slot slot="header" />`，也不能稳定使用 `<block slot="header"><slot /></block>`。真实 WeChat DevTools 运行时中，`block` 路径会丢失转发内容。因此微信平台默认产物是：

```wxml
<weapp-slot-wrapper slot="header">
  <slot />
</weapp-slot-wrapper>
```

全局配置示例：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    vue: {
      template: {
        slotFallbackWrapper: {
          tag: 'view',
          attrs: {
            class: 'slot-wrapper',
          },
          rules: [
            { component: 'IssueCard', slot: 'header', tag: 'cover-view' },
            { componentName: 'HelloWorld', slot: 'header', tag: 'cover-view' },
            { component: 'IssueCard', slot: 'footer', attrs: { class: 'slot-footer' } },
            { component: /^Van/, slot: ['title', 'label'], tag: 'view' },
          ],
        },
      },
    },
  },
})
```

`component` 匹配使用处模板标签名，例如 `<IssueCard>` 对应 `IssueCard`，`<issue-card>` 对应 `issue-card`。如果要按子组件自己的名字匹配，让子组件写静态 `defineOptions({ name: 'HelloWorld' })`，然后使用 `componentName: 'HelloWorld'`。`componentName` 需要编译器能解析到被引用的 Vue SFC；原生小程序组件或第三方小程序组件继续用 `component`。

组件内也可以用静态属性覆盖。`slot-wrapper` 是当前组件所有普通具名插槽的默认 wrapper：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header>
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <cover-view slot="header">
    <slot />
  </cover-view>
  <cover-view slot="footer">
    <slot name="footer" />
  </cover-view>
</IssueCard>
```

`slot-wrapper-<slotName>` 覆盖指定具名插槽。单个 slot 的覆盖更推荐直接写在对应的 `<template #xxx>` 上：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header>
      <slot />
    </template>
    <template #footer slot-wrapper="view">
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <cover-view slot="header">
    <slot />
  </cover-view>
  <view slot="footer">
    <slot name="footer" />
  </view>
</IssueCard>
```

也可以把单个 slot 的覆盖配置写在对应的 `<template #xxx>` 上。这个写法最靠近 slot 内容，也更适合单个 slot 的局部策略：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header slot-wrapper="text" slot-wrapper-class="slot-header">
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

`<template #header>` 上的 `slot-wrapper` / `slot-wrapper-class` / `slot-wrapper-style` / `slot-single-root-no-wrapper` 是该 slot 的就近覆盖，优先级高于父组件标签上的默认值和 `slot-wrapper-header`。

组件内还可以把 class/style 加到生成的 wrapper 上：

```vue
<template>
  <IssueCard slot-wrapper="cover-view">
    <template #header slot-wrapper="cover-view" slot-wrapper-class="slot-default" slot-wrapper-style="padding: 8px">
      <slot />
    </template>
    <template
      #footer
      slot-wrapper="view"
      slot-wrapper-class="slot-footer"
      slot-wrapper-style="margin-top: 12px"
    >
      <slot name="footer" />
    </template>
  </IssueCard>
</template>
```

```wxml
<IssueCard>
  <cover-view slot="header" class="slot-default" style="padding: 8px">
    <slot />
  </cover-view>
  <view slot="footer" class="slot-footer" style="margin-top: 12px">
    <slot name="footer" />
  </view>
</IssueCard>
```

也支持 `:slot-wrapper-class="headerClass"` / `:slot-wrapper-style="headerStyle"` 这类动态绑定；单个 slot 更推荐写成 `<template #footer :slot-wrapper-class="footerClass">` 这种就近覆盖。参数名必须是静态的。

`slot-single-root-no-wrapper-<slotName>` 可以让指定插槽在单根真实节点场景下尽量下推 `slot="..."`：

```vue
<template>
  <IssueCard slot-single-root-no-wrapper-icon>
    <template #icon>
      <image src="/assets/icon.png" />
    </template>
  </IssueCard>
</template>
```

产物：

```wxml
<IssueCard>
  <image slot="icon" src="/assets/icon.png" />
</IssueCard>
```

如果插槽内容是转发 `<slot />`，即使配置了 `slot-single-root-no-wrapper-header`，仍会保留 wrapper：

```wxml
<IssueCard>
  <view slot="header">
    <slot />
  </view>
</IssueCard>
```

`block` 不允许作为 wrapper，会回退到 `view` 并输出 warning。自定义 wrapper 必须是目标小程序运行时可渲染、并且能承载当前 slot 内容的真实节点或组件。例如下面的写法会生成 `text` 包裹 `view`，这不适合真实运行时：

```vue
<template>
  <IssueCard>
    <template #header slot-wrapper="text">
      <view>Header</view>
    </template>
  </IssueCard>
</template>
```

```wxml
<IssueCard>
  <text slot="header">
    <view>Header</view>
  </text>
</IssueCard>
```

### `layout`

页面 layout 既可能来自项目级规则，也可能来自页面侧 `definePageMeta`。排查时先确认是哪一层生效。

### `chunks.sharedStrategy`

常见策略：

- `duplicate`：偏向分包首开性能
- `hoist`：偏向共享抽取与包体控制

不要在 `srcRoot`、路由来源、分包边界都没确认前就先调 chunk 策略。

### `hmr.runtime`

默认值为 `auto`。微信项目会在 `wv dev` 启动时根据开发者工具设置自动选择 HMR 运行时，也可显式锁定状态保持型热更新：

```ts
export default defineConfig({
  weapp: {
    hmr: {
      runtime: 'stateful-experimental',
    },
  },
})
```

安全的 JavaScript/Vue 更新会保留当前 Page/Component 实例、route/query、输入和可序列化 data/setup ref，并替换原生 Page、原生 Component 与 wevu 方法。CSS、资源、JSON/配置、不兼容模块图或补丁失败会回退完整构建与当前路由重载。

`auto` 在 `project.private.config.json` 的 `setting.compileHotReLoad` 严格为 `true` 时选择 `stateful-experimental`，否则选择 `classic`；非微信平台也会回退到 `classic`。该判断只在启动时执行，修改开发者工具设置后需要重启 `wv dev`。启动日志会以 `HMR 模式` 和 `HMR 切换` 两行显示最终模式、选择来源，以及通过 DevTools 热重载开关或 `weapp.hmr.runtime` 切换模式的方法。显式配置通常优先，但 Skyline 兼容降级不受显式配置覆盖。

状态保持模式目前只支持微信小程序 WebView，需要微信开发者工具开启服务端口和热重载。微信开发者工具暂不支持 Skyline 热重载；首次编译检测到任意生成的应用或页面 JSON 使用 `renderer: 'skyline'` 时，`wv dev` 会输出带官方兼容文档链接的警告，将当前项目私有配置中的 `setting.compileHotReLoad` 持久化为 `false`，并强制使用 `classic`，包括显式配置 `stateful-experimental` 的场景。其他私有配置字段不会改变，切回 WebView 后也不会自动重新开启热重载。需要既有写盘/刷新行为时显式配置 `classic`。

### `hmr.touchAppWxss`

默认值为 `auto`，仅在非内置 Tailwind 集成发生真实内容失效时，额外更新已有全局样式的时间戳。内置 `weapp.tailwindcss` 使用 compiler 与 Vite/Rolldown 原生输出作为唯一刷新来源；页面、组件和 layout 的局部样式更新不会额外触碰 `app.wxss`，也不会因为祖先目录能解析到 Tailwind 依赖而触发全局重载。

`true` 保留每次增量构建后的额外全局刷新，可能使微信开发者工具重载 AppService、重置页面状态。`false` 仅关闭额外刷新，不会关闭 Tailwind 内容扫描、样式编译或正常产物更新。该选项只更新已有产物的时间戳，不创建缺失文件、不改写文件内容；除文件不存在外的刷新错误会输出到开发日志。

### `hmr.logLevel` / `hmr.profileJson`

排查开发态热更新慢、共享 chunk 回退或 DevTools 热重载不稳定时，可以临时打开：

```ts
export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'concise',
      profileJson: '.tmp/weapp-vite-hmr-profile.jsonl',
    },
  },
})
```

- `logLevel: 'default' | 'concise' | 'verbose'` 控制终端诊断详细程度。
- `profileJson: boolean | string` 控制是否输出 JSONL profile，字符串表示自定义输出路径。

### `mcp`

`weapp.mcp` 默认启用，但默认不自动启动服务。AI 客户端接入优先走 CLI：

```bash
wv mcp init codex
wv mcp print codex
wv mcp doctor codex
```

## CLI 与 IDE 命令

`weapp-vite` 原生命令优先，IDE 相关命令通过 `weapp-ide-cli` 透传。

例如：

```bash
weapp-vite build
weapp-vite preview -p weapp --mode test
weapp-vite ide preview --project ./dist/build/mp-weixin
```

## 继续阅读

- 项目结构与 `AGENTS.md`：[`project-structure.md`](./project-structure.md)
- wevu 运行时写法：[`wevu-authoring.md`](./wevu-authoring.md)
- Vue SFC 宏与模板：[`vue-sfc.md`](./vue-sfc.md)

## 函数式转换

`weapp.wxml.transform` 接收一个函数或函数数组，支持异步。每个函数收到当前模板源码；数组按声明顺序等待执行。返回 `null` / `undefined` 保持当前源码，返回空字符串清空模板。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      transform: async (code, ctx) => {
        if (ctx.isDev) {
          return
        }
        return ctx.edit(code, (node) => {
          if (node.tagName === 'view') {
            node.removeAttribute('data-testid')
          }
          if (node.tagName === 'button') {
            node.renameAttribute('data-track', 'data-analytics')
            if (!node.hasAttribute('hover-class')) {
              node.setAttribute('hover-class', 'none')
            }
            node.setAttribute('disabled', { expression: 'submitting' })
          }
          if (node.tagName === 'text' && node.hasAttribute('data-use-view')) {
            node.renameTag('view')
            node.removeAttribute('data-use-view')
          }
        })
      },
    },
  },
})
```

匹配编译后的静态标签名，例如 Vue HTML 映射后的 `view`。第一版只转换最终模板：替换成自定义组件时，仍需通过既有 `usingComponents` 等配置注册组件；不会生成组件依赖、JS 或样式。

### 回调上下文

| 字段 / 方法 | 含义 |
| --- | --- |
| `fileName` | 相对输出根目录的 POSIX 文件名，包含分包目录 |
| `root` | 项目根目录 |
| `platform` / `mode` / `isDev` | 当前平台、模式及开发状态 |
| `subPackageRoot` | 独立分包构建的根目录；主包构建（含普通分包）为 `undefined` |
| `edit(code, visitor)` | 返回 `Promise<string>`，支持异步 visitor |
| `addWatchFile(path)` | 注册外部文件依赖，相对路径从项目根目录解析 |
| `warn(message)` / `error(message)` | 报告警告 / 中止本轮构建 |

`WxmlTransform`、`WxmlTransformResult`、`WxmlTransformContext`、`WxmlTransformVisitor`、`WxmlTransformNode`、`WxmlElementInfo`、`WxmlAttribute`、`WxmlAttributeValue`、`WxmlSourceLocation` 均可从 `weapp-vite/config` 和 `weapp-vite/types` 导入。回调执行于构建端，可以使用闭包、正则和异步读取；非法返回值或异常会中止输出，并报告文件名、回调序号及原始错误。

### 编辑节点与属性值

`ctx.edit` 每次只扫描一次，按源码顺序深度优先遍历标签。未修改的区间逐字保留；WXS 等脚本模块的原始内容不作为标签遍历。

- `tagName`、`attributes`、`parent`、`location` 为只读观察信息；位置包含从零开始的 `offset` 和从一开始的 `line` / `column`。父节点没有修改接口。
- `hasAttribute(name)` 和 `getAttribute(name)` 读取当前编辑状态。属性记录包含 `name`、原始 `rawValue` 与 `quote`，不求值动态或混合绑定；无值属性的 `rawValue` 为 `null`。
- `setAttribute(name, value)` 设置属性：字符串为字面量，数字和布尔值输出保持类型的绑定，`{ expression: 'submitting' }` 输出模板表达式。不要给表达式再包 `{{ }}`。
- `setBooleanAttribute(name)` 设置无值属性。`setAttribute(name, false)` 保留布尔 `false` 语义，不表示删除。
- `renameAttribute(from, to)` 保留原值，目标存在时抛错；源不存在时无操作。删除清除全部同名项，设置将重复属性收敛为一个。
- `renameTag(name)` 同时改开始和结束标签；`remove()` 删除整个子树并跳过子节点回调。

同一节点后续操作可以读取已修改状态。编辑句柄仅在当前 `edit` 会话内有效。不提供节点移动、插入或 unwrap；需要这些操作时可自行返回完整源码。

编辑工具沿用关键属性、结构标签及条件链保护。明确修改事件、平台指令或已识别的框架元数据会抛错并附带位置。直接返回源码允许完整控制，不提供上述语义保护；后续 `remove` 与宿主编译检查仍会执行。

### 子节点访问与子树编辑

`node.children` 返回按源码顺序排列的直接子标签；`await node.walk(visitor)` 深度优先遍历全部后代，不包含节点自身。下面的完整配置只处理带 `data-card` 的 `view`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      transform: (code, ctx) => ctx.edit(code, async (node) => {
        if (node.tagName !== 'view' || !node.hasAttribute('data-card')) {
          return
        }

        for (const child of node.children) {
          if (child.tagName === 'text') {
            child.setAttribute('selectable', true)
          }
        }

        await node.walk(async (child) => {
          if (child.hasAttribute('data-private-zone')) {
            child.skipChildren()
            return
          }
          if (child.tagName === 'button') {
            child.setAttribute('hover-class', 'none')
          }
          if (child.hasAttribute('data-debug')) {
            child.remove()
          }
        })
        node.skipChildren()
      }),
    },
  },
})
```

- 直接子 `text` 获得 `selectable="{{true}}"`；更深的 `text` 不会因直接子节点循环而改变。
- 后代 `button` 获得 `hover-class="none"`，带 `data-debug` 的普通标签及其子树删除。带 `data-private-zone` 的标签保留，其后代在这次手动遍历中跳过。
- 末尾的 `node.skipChildren()` 跳过外层自动遍历，避免同一子树再次被外层回调处理；因此示例中的 private zone 也不会再被外层自动遍历访问。删除该行时，外层仍会继续访问所有未删除后代。

| 接口 | 行为 |
| --- | --- |
| `children` | 当前未删除的直接子标签；只读数组，元素是可编辑句柄 |
| `walk(visitor)` | 返回 `Promise<void>`；同步或异步回调按源码顺序逐个等待，不包含自身 |
| `skipChildren()` | 仅跳过当前回调所属遍历的后代；不影响兄弟、其他遍历或输出 |
| `parent.children` | 只读观察节点，不允许借父节点修改祖先或兄弟 |

每次读取 `children` 得到一个数组快照；旧数组不会自动减少，删除节点及其全部后代的编辑句柄立即失效。子节点提前改名或修改属性后，后续自动回调与父节点观察到的是同一份新状态。源码位置始终对应本次 `edit` 输入，不因编辑重新计算。

手动 `walk` 每调用一次都会遍历一次，不会自动消费外层遍历；多层标记容器可能因此重复处理后代。若某个容器已负责全部后代处理，在它的外层回调中显式 `skipChildren()`。先 `skipChildren()` 再显式 `walk()` 也有效。内层回调中的跳过只属于内层遍历，不会跳过外层后续访问。

`skipChildren()` 只能对当前正在回调的节点调用；对 `children[0]`、其他保存的节点或回调结束后的句柄调用会报带源码位置的错误。嵌套遍历必须正确 `await`／`return`；同一编辑会话不支持 `Promise.all` 并发遍历或编辑，也不要发起未等待的异步任务或跨构建保存节点句柄。

`children` 与 `walk` 只识别本模板里的标签，不包含文本、注释、插值和 WXS/SJS 原始内容，不展开导入模板或自定义组件内部。事件、指令、结构标签、框架元数据与条件链保护在子树操作中同样生效。删除整个父节点会覆盖已记录的子节点编辑，并跳过全部相关后代回调。

`validate` 的 `node.children` 同样可用于结构检查，但元素只有只读观察接口；遍历仍用 `ctx.walk()`，没有节点编辑、`node.walk()` 或 `skipChildren()`：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      validate: async (_code, ctx) => {
        await ctx.walk((node) => {
          if (node.hasAttribute('data-card')
            && !node.children.some(child => child.tagName === 'button')) {
            ctx.report({
              severity: 'warning',
              code: 'card-button',
              message: '卡片缺少直接子 button',
              location: node.location,
            })
          }
        })
      },
    },
  },
})
```

### 输出顺序与热更新

执行顺序：模板编译 / 平台归一化 / i18n → `transform` → `remove` → 既有 Tailwind 与 compiler-plugin 输出处理 → `validate` → HMR 内容比较 → bundler 输出。后续输出插件仍可修改模板。独立分包转换完成后汇入主包，不重复转换。

外部规则文件必须显式调用 `ctx.addWatchFile('rules.json')`，建议在读取前注册，以便文件缺失导致构建失败后仍能恢复。外部依赖修改、删除、恢复会触发完整模板重建，覆盖主包、普通和独立分包。同一文件跨模板注册会去重；不自动追踪任意文件读取、环境变量或网络请求，也不允许监听构建输出目录。

每轮从当前编译输入重新转换，避免连续 HMR 累加上轮结果。回调应根据输入与显式依赖生成结果；不保证跨文件、跨分包的全局调用顺序，也不保证整个开发会话只调用一次。未配置 `transform` 时不增加编辑扫描；只返回字符串而不调用 `edit` 时，也不会为了回调额外解析模板。

## 最终模板校验

`weapp.wxml.validate` 在 `transform`、`remove` 和框架管理的 Tailwind / compiler-plugin 输出处理完成后执行，在 HMR 内容比较和发布前检查模板。可用于禁止调试节点残留、检查指定标签的必填属性或验证项目约定；默认不启用任何规则。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      remove: { attr: [{ tag: 'view', name: 'data-testid' }] },
      validate: async (_code, ctx) => {
        if (ctx.isDev) {
          return
        }
        await ctx.walk((node) => {
          if (node.tagName === 'debug-panel') {
            ctx.report({
              severity: 'error',
              code: 'no-debug-panel',
              message: '发布模板不能包含 debug-panel',
              location: node.location,
            })
          }
          if (node.tagName === 'button' && !node.hasAttribute('data-track')) {
            ctx.report({
              severity: 'warning',
              code: 'button-tracking',
              message: 'button 缺少 data-track',
              location: node.location,
            })
          }
        })
      },
    },
  },
})
```

### 校验接口与诊断

```ts
type WxmlValidate = (
  code: string,
  ctx: WxmlValidationContext,
) => void | Promise<void>

interface WxmlValidationDiagnostic {
  severity: 'warning' | 'error'
  code?: string
  message: string
  location?: WxmlSourceLocation
}

// weapp.wxml
// validate?: WxmlValidate | WxmlValidate[]
```

`WxmlValidate`、`WxmlValidationContext`、`WxmlValidationVisitor`、`WxmlValidationDiagnostic` 均从 `weapp-vite/config` 和 `weapp-vite/types` 导出。

- 单函数和函数数组都支持异步；数组按声明顺序等待，所有回调读取同一份模板。返回值必须为 `undefined`，返回字符串、`null`、`false` 等会报错；修改模板请使用 `transform`。
- `ctx.walk(visitor)` 返回 `Promise<void>`，须 `await` 或 `return`。同步／异步 visitor 按源码顺序深度优先访问节点；同一模板在本轮多个回调间复用一次扫描，只检查 `code` 而不遍历时不解析。
- 节点使用只读 `WxmlElementInfo`：`tagName`、`attributes`、`children`、`parent`、`location`、`hasAttribute`、`getAttribute`；没有 `setAttribute`、`renameTag` 或 `remove`。属性、父节点和位置不可改写。
- 属性 `rawValue` 不解码、不求值，`{{tracking}}` 不代表已知运行时值。静态值规则只比较可确定的字面内容，校验不能判断页面数据变化后的属性值。
- `ctx.report` 的 `warning` 允许输出，`error` 汇总当前构建内其他回调及模板的正常诊断后阻止输出。同轮同文件、回调、严重程度、代码、消息和位置均相同的诊断去重。
- 诊断包含输出相对路径、从 1 开始的回调序号、可选规则代码和行列；不传 `location` 时为文件级诊断。位置对应本轮最终模板，不映射回 `.vue` 源文件。
- 回调异常、扫描失败、非法返回值或诊断格式立即中止并保留原始错误；没有静默跳过或自动修复。失败不会推进该构建的成功输出缓存，独立分包失败会传递到主构建。

上下文提供与 `transform` 相同含义的 `fileName`、`root`、`platform`、`mode`、`isDev`、`subPackageRoot` 和 `addWatchFile`；不提供 `edit`，校验诊断统一通过 `report` 发出。

### 按范围校验与复用规则

下面把普通分包的静态属性检查拆成可复用函数；`fileName` 为输出相对 POSIX 路径，`subPackageRoot` 只标识独立分包构建，普通分包应按路径筛选。

```ts
import type { WxmlValidate } from 'weapp-vite/config'
import { defineConfig } from 'weapp-vite/config'

const checkCheckout: WxmlValidate = async (_code, ctx) => {
  if (ctx.platform !== 'weapp' || !ctx.fileName.startsWith('packages/checkout/')) {
    return
  }
  await ctx.walk((node) => {
    if (node.tagName === 'button' && node.getAttribute('data-track')?.rawValue === '') {
      ctx.report({ severity: 'error', message: '静态埋点属性不可为空字符串', location: node.location })
    }
  })
}

export default defineConfig({
  weapp: { wxml: { validate: [checkCheckout] } },
})
```

校验按最终静态标签名匹配，因此 Vue HTML 映射后的 `div` 通常需要检查 `view`。已被 `remove` 删除的节点不会再命中；输出插件新添加的节点会被检查。独立分包在所属构建中校验一次，汇入主包不重复执行。

### 外部规则与 HMR

外部规则文件与转换阶段共用监听、分阶段记录依赖。在读取前登记文件，即使文件缺失导致失败，也能在恢复时触发重新构建：

```ts
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxml: {
      validate: async (_code, ctx) => {
        ctx.addWatchFile('wxml-policy.json')
        const policy: unknown = JSON.parse(await readFile(resolve(ctx.root, 'wxml-policy.json'), 'utf8'))
        if (!Array.isArray(policy) || !policy.every(tag => typeof tag === 'string')) {
          throw new Error('wxml-policy.json 必须是禁用标签名的字符串数组')
        }
        const forbidden = new Set<string>(policy)
        await ctx.walk((node) => {
          if (forbidden.has(node.tagName)) {
            ctx.report({ severity: 'error', message: `不允许使用 ${node.tagName}`, location: node.location })
          }
        })
      },
    },
  },
})
```

`wxml-policy.json` 例如 `["debug-panel"]`。同一文件跨模板或阶段登记会去重；修改、删除、恢复触发完整模板重建与校验。局部构建保留未触及模板的依赖，成功完整构建清理失效登记。不要监听输出目录，也不要把一次读取的结果永久缓存而忽略规则更新。

“最终”指框架管理的输出链完成后的模板，不保证覆盖任意排在该阶段之后的第三方 Vite 插件修改。不保证跨文件／分包回调顺序，不追踪任意文件读取、环境变量或网络响应；第一版不提供内置业务规则、跨文件全局校验、独立 CLI 或报告文件，也不能替代宿主完整语法和运行时检查。
