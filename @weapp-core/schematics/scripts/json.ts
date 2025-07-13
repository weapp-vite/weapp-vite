import * as z from 'zod'
// import { zodToJsonSchema } from 'zod-to-json-schema'

// https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html

export const metaSchema = z.object({
  $schema: z.string(),
}).partial()

export const sharedSchema = z.object({
  usingComponents: z.record(z.string(), z.string()),
  componentFramework: z.string(),
}).partial().extend(metaSchema.shape)

export const pageAndComponentSharedSchema = z.looseObject({
  componentPlaceholder: z.looseObject({}),
}).partial().extend(sharedSchema.shape)

export const appAndPageSharedSchema = z.looseObject({
  style: z.string(),
  singlePage: z.looseObject({}),
  enablePassiveEvent: z.looseObject({}).or(z.boolean()),
  renderer: z.enum(['webview', 'skyline']).default('webview'),
  rendererOptions: z.looseObject({
    skyline: z.looseObject({
      defaultDisplayBlock: z.boolean().default(false),
      defaultContentBox: z.boolean().default(false),
      disableABTest: z.boolean().default(false),
    }).partial(),
  }).partial(),
}).partial().extend(sharedSchema.shape)

export const windowSchema = z.looseObject({
  navigationBarBackgroundColor: z.string().default('#000000'),
  navigationBarTextStyle: z.string().default('white'),
  navigationBarTitleText: z.string(),
  navigationStyle: z.enum(['default', 'custom']).default('default'), // z.string()
  homeButton: z.boolean().default(false),
  backgroundColor: z.string().default('#ffffff'),
  backgroundTextStyle: z.enum(['dark', 'light']).default('dark'),
  backgroundColorTop: z.string().default('#ffffff'),
  backgroundColorBottom: z.string().default('#ffffff'),
  enablePullDownRefresh: z.boolean().default(false),
  onReachBottomDistance: z.number().default(50),
  pageOrientation: z.enum(['portrait', 'auto', 'landscape']).default('portrait'),
  restartStrategy: z.enum(['homePage', 'homePageAndLatestPage']).default('homePage'),
  initialRenderingCache: z.enum(['static', 'dynamic']),
  visualEffectInBackground: z.enum(['none', 'hidden']).default('none'),
  handleWebviewPreload: z.enum(['static', 'manual', 'auto']).default('static'),
}).partial()

export const tabBarSchema = z.looseObject({
  color: z.string(),
  selectedColor: z.string(),
  backgroundColor: z.string(),
  borderStyle: z.enum(['black', 'white']).default('black'),
  list: z.array(
    z.looseObject({
      pagePath: z.string(),
      text: z.string(),
      iconPath: z.string(),
      selectedIconPath: z.string(),
    }).partial().required({
      pagePath: true,
      text: true,
    }),
  ).min(2).max(5),
  position: z.enum(['bottom', 'top']).default('bottom'),
  custom: z.boolean(),
}).partial().required({
  color: true,
  selectedColor: true,
  list: true,
  backgroundColor: true,
})

export const networkTimeoutSchema = z.looseObject({
  request: z.number().default(60000),
  connectSocket: z.number().default(60000),
  uploadFile: z.number().default(60000),
  downloadFile: z.number().default(60000),
}).partial()

export const subpackageSchema = z.looseObject({
  root: z.string(),
  name: z.string(),
  pages: z.string().array(),
  independent: z.boolean(),
  entry: z.string(),
}).partial()

const subpackageSchemaArray = z.array(subpackageSchema)

export const AppSchema = z
  .looseObject({
    // https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#entryPagePath
    entryPagePath: z.string().describe('指定小程序的默认启动路径（首页），常见情景是从微信聊天列表页下拉启动、小程序列表启动等。如果不填，将默认为 pages 列表的第一项。不支持带页面路径参数。'),
    pages: z.array(z.string()).describe('用于指定小程序由哪些页面组成，每一项都对应一个页面的 路径（含文件名） 信息。文件名不需要写文件后缀，框架会自动去寻找对应位置的 .json, .js, .wxml, .wxss 四个文件进行处理。'),
    window: windowSchema,
    tabBar: tabBarSchema,
    networkTimeout: networkTimeoutSchema,
    debug: z.boolean(),
    functionalPages: z.boolean(),
    subpackages: subpackageSchemaArray,
    subPackages: subpackageSchemaArray,
    // https://developers.weixin.qq.com/miniprogram/dev/framework/workers.html
    workers: z.union([
      z.string(),
      z.looseObject({
        path: z.string(),
        isSubpackage: z.boolean(),
      }).partial(),
    ]),
    requiredBackgroundModes: z.array(z.string()),
    requiredPrivateInfos: z.array(z.string()),
    plugins: z.looseObject({}),
    preloadRule: z.looseObject({}),
    resizable: z.boolean(),
    permission: z.looseObject({}),
    // 虽然文档上是必填的，但是实际上是非必填
    sitemapLocation: z.string(),
    useExtendedLib: z.looseObject({}),
    entranceDeclare: z.looseObject({}),
    darkmode: z.boolean(),
    themeLocation: z.string(),
    lazyCodeLoading: z.string(),
    supportedMaterials: z.looseObject({}),
    serviceProviderTicket: z.string(),
    embeddedAppIdList: z.array(z.string()),
    halfPage: z.looseObject({}),
    debugOptions: z.looseObject({}),
    resolveAlias: z.looseObject({}),
    miniApp: z.looseObject({}),
    static: z.looseObject({}),
    convertRpxToVw: z.boolean(),
    appBar: z.looseObject({}),
  })
  .partial()
  .required({
    pages: true,
  })
  .extend(appAndPageSharedSchema.shape)
  .describe('全局配置, 小程序根目录下的 app.json 文件用来对微信小程序进行全局配置。')

export const PageSchema = z
  .looseObject({
    backgroundColorContent: z.string().default('#RRGGBBAA'),
    disableScroll: z.boolean().default(false),
    styleIsolation: z.enum(['page-isolated', 'page-apply-shared', 'page-shared']),
  })
  .partial()
  .extend(appAndPageSharedSchema.shape)
  .extend(pageAndComponentSharedSchema.shape)
  .extend(windowSchema.shape)
  .describe('页面配置, 支持对单个页面进行配置，可以在页面对应的 .json 文件来对本页面的表现进行配置')

export const ComponentSchema = z
  .looseObject({
    component: z.boolean().default(true),
    styleIsolation: z.enum(['isolated', 'apply-shared', 'shared']).default('isolated'),
    componentGenerics: z.looseObject({}),
  })
  .partial()
  .extend(pageAndComponentSharedSchema.shape)
  .describe('自定义组件配置')

export const AppJsonSchema = z.toJSONSchema(AppSchema)

export const PageJsonSchema = z.toJSONSchema(PageSchema)

export const ComponentJsonSchema = z.toJSONSchema(ComponentSchema)

export const ThemeSchema = z.looseObject({
  light: z.looseObject({}),
  dark: z.looseObject({}),
}).extend(metaSchema.shape)

export const SitemapSchema = z.looseObject({
  rules: z.object({
    action: z.enum(['allow', 'disallow']).default('allow'),
    page: z.string(),
    params: z.string().array(),
    matching: z.enum(['exact', 'inclusive', 'exclusive', 'partial']).default('inclusive'),
    priority: z.number(),
  }).partial({
    action: true,
    params: true,
    matching: true,
    priority: true,
  }).array(),
}).extend(metaSchema.shape).describe('https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/sitemap.html')

export const ThemeJsonSchema = z.toJSONSchema(ThemeSchema)

export const SitemapJsonSchema = z.toJSONSchema(SitemapSchema)

export const PluginSchema = z.looseObject({
  publicComponents: z.record(z.string(), z.string()),
  pages: z.record(z.string(), z.string()),
  main: z.string(),
})
  .partial()
  .describe('https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/development.html#%E6%8F%92%E4%BB%B6%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6')

export const PluginJsonSchema = z.toJSONSchema(PluginSchema)
