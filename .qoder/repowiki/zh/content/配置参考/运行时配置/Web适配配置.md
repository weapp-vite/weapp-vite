# Web适配配置

<cite>
**本文档引用的文件**
- [weapp-vite-web-demo/vite.config.ts](file://apps/weapp-vite-web-demo/vite.config.ts)
- [weapp-vite/src/runtime/config/web.ts](file://packages/weapp-vite/src/runtime/config/web.ts)
- [weapp-vite/src/types/config.ts](file://packages/weapp-vite/src/types/config.ts)
- [weapp-vite/src/runtime/config/types.ts](file://packages/weapp-vite/src/runtime/config/types.ts)
- [weapp-vite/src/runtime/config/internal/merge.ts](file://packages/weapp-vite/src/runtime/config/internal/merge.ts)
- [weapp-vite/src/runtime/webPlugin.ts](file://packages/weapp-vite/src/runtime/webPlugin.ts)
- [web/src/plugin.ts](file://packages/web/src/plugin.ts)
- [weapp-vite-web-demo/index.html](file://apps/weapp-vite-web-demo/index.html)
</cite>

## 目录
1. [简介](#简介)
2. [Web配置对象属性详解](#web配置对象属性详解)
3. [Web适配配置示例](#web适配配置示例)
4. [配置解析与处理机制](#配置解析与处理机制)
5. [Web插件工作原理](#web插件工作原理)
6. [构建与开发服务器集成](#构建与开发服务器集成)
7. [最佳实践与注意事项](#最佳实践与注意事项)

## 简介

weapp-vite提供了将小程序项目适配到Web平台的能力，通过配置`web`对象来控制Web端的构建和运行行为。该配置允许开发者指定Web项目的根目录、源码目录、输出目录以及Vite的特定配置，从而实现小程序代码在Web环境中的运行。

**Web适配的核心功能包括：**
- 将小程序的WXML模板转换为Web可渲染的函数
- 将WXSS样式文件转换为标准CSS
- 处理小程序特有的API调用，使其在Web环境中正常工作
- 管理资源路径和模块加载
- 支持在开发环境中启动独立的Web开发服务器

这种跨平台适配能力使得开发者可以使用同一套代码基础，同时支持小程序和Web应用，提高了开发效率和代码复用率。

## Web配置对象属性详解

weapp-vite的Web配置对象提供了多个属性来控制Web平台的适配行为。这些属性定义在`WeappWebConfig`接口中，每个属性都有特定的功能和默认值。

### enable（启用Web适配）

`enable`属性用于控制是否启用Web平台适配功能。这是一个布尔值属性，当设置为`true`或未指定时，Web适配功能将被启用；当设置为`false`时，Web适配功能将被禁用。

```typescript
interface WeappWebConfig {
  /**
   * @description 是否启用浏览器端运行时集成
   * @default false
   */
  enable?: boolean
}
```

当`enable`属性为`false`时，系统将不会创建Web服务，也不会执行Web相关的构建任务。这是配置Web适配的开关，决定了整个Web适配流程是否启动。

**Section sources**
- [weapp-vite/src/types/config.ts](file://packages/weapp-vite/src/types/config.ts#L200-L205)

### root（Web项目根目录）

`root`属性指定了Web侧项目的根目录，即`index.html`文件所在的目录。这个目录是Web构建的基准路径，所有相对路径都将基于此目录进行解析。

```typescript
interface WeappWebConfig {
  /**
   * @description Web 侧项目根目录（即 index.html 所在目录）
   * @default 项目根目录
   */
  root?: string
}
```

如果未指定`root`属性，系统将使用项目的根目录作为Web项目的根目录。通过自定义`root`，开发者可以将Web资源组织在特定的子目录中，实现更清晰的项目结构。

**Section sources**
- [weapp-vite/src/types/config.ts](file://packages/weapp-vite/src/types/config.ts#L207-L210)

### srcDir（源码目录）

`srcDir`属性指定了小程序源码目录，该路径是相对于`root`目录的。这个属性告诉构建系统在哪里查找小程序的源代码文件。

```typescript
interface WeappWebConfig {
  /**
   * @description 小程序源码目录（相对于 `root`），默认与 `weapp.srcRoot` 保持一致
   */
  srcDir?: string
}
```

如果未指定`srcDir`，系统将使用`weapp.srcRoot`的值作为源码目录。通过这个配置，开发者可以灵活地组织源代码的位置，适应不同的项目结构需求。

**Section sources**
- [weapp-vite/src/types/config.ts](file://packages/weapp-vite/src/types/config.ts#L212-L214)

### outDir（输出目录）

`outDir`属性定义了Web构建产物的输出目录，相对路径基于`root`目录。构建生成的HTML、CSS、JavaScript等文件都将放置在这个目录中。

```typescript
interface WeappWebConfig {
  /**
   * @description Web 构建产物输出目录；相对路径基于 `root`
   * @default "dist-web"
   */
  outDir?: string
}
```

默认情况下，构建产物将输出到`dist-web`目录。开发者可以通过修改`outDir`来指定不同的输出位置，例如`build/web`或`public`等目录，以满足部署需求。

**Section sources**
- [weapp-vite/src/types/config.ts](file://packages/weapp-vite/src/types/config.ts#L216-L218)

### pluginOptions（插件选项）

`pluginOptions`属性允许开发者传递额外的参数给`weappWebPlugin`，这些参数不包括`srcDir`（因为`srcDir`会单独处理）。通过这个配置，可以定制Web插件的行为。

```typescript
interface WeappWebConfig {
  /**
   * @description 传递给 `weappWebPlugin` 的额外参数（不包含 `srcDir`）
   */
  pluginOptions?: Partial<Omit<WeappWebPluginOptions, 'srcDir'>>
}
```

`pluginOptions`可以包含WXSS转换选项等配置，允许开发者精细控制样式转换的行为，例如像素单位的转换比例等。

**Section sources**
- [weapp-vite/src/types/config.ts](file://packages/weapp-vite/src/types/config.ts#L223-L224)

### vite（Vite配置）

`vite`属性允许开发者合并额外的Vite内联配置到Web构建中。这为Web特定的构建需求提供了灵活性，可以覆盖或扩展默认的Vite配置。

```typescript
interface WeappWebConfig {
  /**
   * @description 额外合并到 Web 构建中的 Vite 内联配置
   */
  vite?: InlineConfig
}
```

通过`vite`配置，开发者可以设置Web开发服务器的主机、端口、是否自动打开浏览器等选项，也可以配置构建优化、插件等高级功能。

**Section sources**
- [weapp-vite/src/types/config.ts](file://packages/weapp-vite/src/types/config.ts#L227-L228)

## Web适配配置示例

以下是一个完整的Web适配配置示例，展示了如何在`vite.config.ts`中设置Web相关选项。

```typescript
import { defineConfig } from 'weapp-vite/config'

const webHost = process.env.WEAPP_WEB_HOST
const portValue = process.env.WEAPP_WEB_PORT
const parsedPort = portValue ? Number.parseInt(portValue, 10) : undefined
const webPort = Number.isFinite(parsedPort) ? parsedPort : undefined
const shouldOpen = process.env.WEAPP_WEB_OPEN === 'true'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      globs: [
        'components/**/*.wxml',
        'components/**/*.html',
      ],
      typedComponents: 'typed-components.d.ts',
      htmlCustomData: 'mini-program.html-data.json',
    },
    web: {
      vite: {
        server: {
          host: webHost ?? '127.0.0.1',
          port: webPort ?? 5173,
          open: shouldOpen,
        },
      },
    },
  },
})
```

在这个示例中，我们配置了Web开发服务器的主机地址、端口号和是否自动打开浏览器。这些配置通过环境变量进行参数化，使得配置更加灵活，可以在不同环境中使用不同的设置。

**Section sources**
- [weapp-vite-web-demo/vite.config.ts](file://apps/weapp-vite-web-demo/vite.config.ts#L1-L31)

## 配置解析与处理机制

weapp-vite通过一系列函数和机制来解析和处理Web配置，确保配置的正确性和一致性。

### 配置解析函数

`resolveWeappWebConfig`函数负责解析和标准化Web配置。它接收工作目录、源码根目录和配置对象作为参数，返回一个解析后的配置对象。

```typescript
export function resolveWeappWebConfig(options: ResolveWebConfigOptions): ResolvedWeappWebConfig | undefined {
  const { cwd, srcRoot, config } = options
  if (!config) {
    return undefined
  }

  const enabled = config.enable !== false
  if (!enabled) {
    return undefined
  }

  const root = config.root ? path.resolve(cwd, config.root) : cwd
  const srcDir = normalizeSrcDir(root, cwd, srcRoot, config)
  const outDir = normalizeOutDir(root, config)
  const pluginOptions = {
    ...(config.pluginOptions ?? {}),
    srcDir,
  }

  const userConfig: InlineConfig | undefined = config.vite

  return {
    enabled: true,
    root,
    srcDir,
    outDir,
    pluginOptions,
    userConfig,
    source: config,
  }
}
```

这个函数首先检查配置是否启用，然后解析`root`、`srcDir`和`outDir`等路径，最后返回一个包含所有必要信息的解析后配置对象。

**Section sources**
- [weapp-vite/src/runtime/config/web.ts](file://packages/weapp-vite/src/runtime/config/web.ts#L39-L69)

### 路径标准化

在配置解析过程中，weapp-vite使用`normalizeSrcDir`和`normalizeOutDir`函数来标准化源码目录和输出目录的路径。

```typescript
function normalizeSrcDir(root: string, cwd: string, srcRoot: string, config?: WeappWebConfig) {
  if (!config) {
    const absoluteSrc = path.resolve(cwd, srcRoot)
    return path.relative(root, absoluteSrc) || ''
  }

  if (config.srcDir) {
    if (path.isAbsolute(config.srcDir)) {
      return path.relative(root, config.srcDir)
    }
    return config.srcDir
  }

  const absoluteSrc = path.resolve(cwd, srcRoot)
  return path.relative(root, absoluteSrc) || ''
}

function normalizeOutDir(root: string, config?: WeappWebConfig) {
  if (!config?.outDir) {
    return path.resolve(root, 'dist-web')
  }
  if (path.isAbsolute(config.outDir)) {
    return config.outDir
  }
  return path.resolve(root, config.outDir)
}
```

这些函数确保了路径的正确性和一致性，无论用户输入的是绝对路径还是相对路径，都能被正确处理。

**Section sources**
- [weapp-vite/src/runtime/config/web.ts](file://packages/weapp-vite/src/runtime/config/web.ts#L12-L37)

## Web插件工作原理

weapp-vite的Web适配功能通过`weappWebPlugin`插件实现，该插件在Vite构建过程中处理小程序特有的文件和语法。

### 插件核心功能

`weappWebPlugin`是一个Vite插件，它实现了多个钩子函数来处理不同类型的文件：

- `configResolved`：在配置解析完成后执行，初始化插件状态
- `buildStart`：在构建开始时执行，扫描项目结构
- `resolveId`：解析特定的模块ID，如Web入口
- `load`：加载特定模块的内容
- `handleHotUpdate`：处理热更新
- `transform`：转换源代码

```typescript
export function weappWebPlugin(options: WeappWebPluginOptions = {}): Plugin {
  let root = process.cwd()
  let srcRoot = resolve(root, options.srcDir ?? 'src')
  const moduleMeta = new Map<string, ModuleMeta>()
  let scanResult: ScanResult = {
    app: undefined,
    pages: [],
    components: [],
  }

  const wxssOptions = options.wxss

  return {
    name: '@weapp-vite/web',
    enforce: 'pre',
    async configResolved(config) {
      root = config.root
      srcRoot = resolve(root, options.srcDir ?? 'src')
      await scanProject()
    },
    async buildStart() {
      await scanProject()
    },
    resolveId(id) {
      if (id === '/@weapp-vite/web/entry' || id === '@weapp-vite/web/entry') {
        return ENTRY_ID
      }
      return null
    },
    load(id) {
      if (id === ENTRY_ID) {
        return generateEntryModule(scanResult, root)
      }
      return null
    },
    async handleHotUpdate(ctx) {
      const clean = cleanUrl(ctx.file)
      if (clean.endsWith('.json') || isTemplateFile(clean) || clean.endsWith('.wxss') || SCRIPT_EXTS.includes(extname(clean))) {
        await scanProject()
      }
    },
    transform(code, id) {
      // 转换逻辑
    },
  }
}
```

**Section sources**
- [web/src/plugin.ts](file://packages/web/src/plugin.ts#L86-L278)

### 模板与样式转换

Web插件对小程序的WXML模板和WXSS样式进行特殊处理：

- **模板转换**：将WXML模板转换为JavaScript函数，使用`createTemplate`函数创建渲染函数
- **样式转换**：将WXSS样式转换为CSS，并生成内联样式注入代码

```typescript
if (isTemplateFile(clean)) {
  const template = JSON.stringify(code)
  return {
    code: [
      `import { createTemplate } from '@weapp-vite/web/runtime'`,
      `const render = createTemplate(${template})`,
      `export default render`,
    ].join('\n'),
    map: null,
  }
}

if (TRANSFORM_STYLE_EXTS.some(ext => clean.endsWith(ext))) {
  const { css } = transformWxssToCss(code, wxssOptions)
  const serialized = JSON.stringify(css)
  return {
    code: [
      // 样式注入代码
      `const css = ${serialized}`,
      `export default css`,
      `export function useStyle(id) {`,
      `  return injectStyle(css, id)`,
      `}`,
    ].join('\n'),
    map: null,
  }
}
```

这些转换确保了小程序的UI组件能够在Web环境中正确渲染。

**Section sources**
- [web/src/plugin.ts](file://packages/web/src/plugin.ts#L127-L192)

## 构建与开发服务器集成

weapp-vite通过`WebService`接口和`mergeWeb`函数将Web构建与开发服务器集成到整体构建流程中。

### Web服务接口

`WebService`接口定义了Web服务的核心功能：

```typescript
export interface WebService {
  readonly devServer?: ViteDevServer
  isEnabled: () => boolean
  startDevServer: () => Promise<ViteDevServer | undefined>
  build: () => Promise<Awaited<ReturnType<typeof build>> | undefined>
  close: () => Promise<void>
}
```

这个接口提供了检查Web服务是否启用、启动开发服务器、执行构建和关闭服务的方法。

**Section sources**
- [weapp-vite/src/runtime/webPlugin.ts](file://packages/weapp-vite/src/runtime/webPlugin.ts#L5-L11)

### 配置合并

`mergeWeb`函数负责将Web配置与主配置合并，创建适用于Web构建的Vite配置：

```typescript
function mergeWeb(...configs: Partial<InlineConfig | undefined>[]) {
  ensureConfigService()
  const currentOptions = getOptions()
  const web = currentOptions.weappWeb
  if (!web?.enabled) {
    return undefined
  }

  applyRuntimePlatform('web')

  const inline = defu<InlineConfig, (InlineConfig | undefined)[]>(
    currentOptions.config,
    web.userConfig,
    ...configs,
    {
      root: web.root,
      mode: currentOptions.mode,
      configFile: false,
      define: getDefineImportMetaEnv(),
      build: {
        outDir: web.outDir,
        emptyOutDir: !currentOptions.isDev,
      },
    },
  )

  // 插件处理逻辑
  inline.plugins = [webPlugin, ...remaining]

  return inline
}
```

这个函数确保了Web构建使用正确的根目录、输出目录和插件配置。

**Section sources**
- [weapp-vite/src/runtime/config/internal/merge.ts](file://packages/weapp-vite/src/runtime/config/internal/merge.ts#L231-L299)

## 最佳实践与注意事项

在使用weapp-vite的Web适配功能时，遵循以下最佳实践可以获得更好的开发体验和构建结果。

### 环境变量配置

使用环境变量来配置Web开发服务器的参数，可以提高配置的灵活性：

```typescript
const webHost = process.env.WEAPP_WEB_HOST
const webPort = process.env.WEAPP_WEB_PORT ? Number.parseInt(process.env.WEAPP_WEB_PORT, 10) : undefined
const shouldOpen = process.env.WEAPP_WEB_OPEN === 'true'
```

这样可以在不同的开发环境中使用不同的设置，而无需修改代码。

### 路径管理

正确管理路径配置，确保源码目录、根目录和输出目录的设置符合项目结构：

- 使用相对路径时，确保路径相对于正确的基准目录
- 避免使用硬编码的绝对路径
- 在多环境部署时，考虑路径配置的可移植性

### 构建优化

利用Vite的构建优化功能，提高Web应用的性能：

- 配置适当的代码分割策略
- 启用压缩和混淆
- 优化资源加载顺序
- 使用缓存和预加载

### 调试与测试

在开发过程中，充分利用热更新和调试工具：

- 确保热更新正常工作，提高开发效率
- 使用浏览器开发者工具调试Web应用
- 测试Web应用在不同浏览器和设备上的兼容性
- 验证小程序特有功能在Web环境中的行为

通过遵循这些最佳实践，可以确保Web适配配置的正确性和有效性，实现高质量的跨平台应用开发。

**Section sources**
- [weapp-vite-web-demo/vite.config.ts](file://apps/weapp-vite-web-demo/vite.config.ts#L3-L7)
- [weapp-vite-web-demo/index.html](file://apps/weapp-vite-web-demo/index.html#L1-L12)