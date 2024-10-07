import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html

export const sharedSchema = z.object({
  usingComponents: z.object({}).optional(),
  componentFramework: z.string().optional(),
})

export const pageAndComponentSharedSchema = z.object({
  componentPlaceholder: z.object({}).optional(),
}).merge(sharedSchema)

export const appAndPageSharedSchema = z.object({
  style: z.string().optional(),
  singlePage: z.object({}).optional(),
  enablePassiveEvent: z.object({}).or(z.boolean()).optional(),
  renderer: z.enum(['webview', 'skyline']).optional().default('webview'),
  rendererOptions: z.object({
    skyline: z.object({
      defaultDisplayBlock: z.boolean().optional().default(false),
      defaultContentBox: z.boolean().optional().default(false),
      disableABTest: z.boolean().optional().default(false),
    }).optional(),
  }).optional(),
}).merge(sharedSchema)

export const windowSchema = z.object({
  navigationBarBackgroundColor: z.string().optional().default('#000000'),
  navigationBarTextStyle: z.string().optional().default('white'),
  navigationBarTitleText: z.string().optional(),
  navigationStyle: z.enum(['default', 'custom']).optional().default('default'), // z.string()
  homeButton: z.boolean().optional().default(false),
  backgroundColor: z.string().optional().default('#ffffff'),
  backgroundTextStyle: z.enum(['dark', 'light']).optional().default('dark'),
  backgroundColorTop: z.string().optional().default('#ffffff'),
  backgroundColorBottom: z.string().optional().default('#ffffff'),
  enablePullDownRefresh: z.boolean().optional().default(false),
  onReachBottomDistance: z.number().optional().default(50),
  pageOrientation: z.enum(['portrait', 'auto', 'landscape']).optional().default('portrait'),
  restartStrategy: z.enum(['homePage', 'homePageAndLatestPage']).optional().default('homePage'),
  initialRenderingCache: z.enum(['static', 'dynamic']).optional(),
  visualEffectInBackground: z.enum(['none', 'hidden']).optional().default('none'),
  handleWebviewPreload: z.enum(['static', 'manual', 'auto']).optional().default('static'),
})

export const tabBarSchema = z.object({
  color: z.string(),
  selectedColor: z.string(),
  backgroundColor: z.string(),
  borderStyle: z.enum(['black', 'white']).optional().default('black'),
  list: z.array(
    z.object({
      pagePath: z.string(),
      text: z.string(),
      iconPath: z.string().optional(),
      selectedIconPath: z.string().optional(),
    }),
  ).min(2).max(5),
  position: z.enum(['bottom', 'top']).optional().default('bottom'),
  custom: z.boolean().optional(),
})

export const networkTimeoutSchema = z.object({
  request: z.number().optional().default(60000),
  connectSocket: z.number().optional().default(60000),
  uploadFile: z.number().optional().default(60000),
  downloadFile: z.number().optional().default(60000),
})

export const subpackageSchema = z.object({
  root: z.string().optional(),
  name: z.string().optional(),
  pages: z.string().array().optional(),
  independent: z.boolean().optional(),
  entry: z.string().optional(),
})

export const AppSchema = z
  .object({
    // https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#entryPagePath
    entryPagePath: z.string().optional().describe('指定小程序的默认启动路径（首页），常见情景是从微信聊天列表页下拉启动、小程序列表启动等。如果不填，将默认为 pages 列表的第一项。不支持带页面路径参数。'),
    pages: z.array(z.string()).describe('用于指定小程序由哪些页面组成，每一项都对应一个页面的 路径（含文件名） 信息。文件名不需要写文件后缀，框架会自动去寻找对应位置的 .json, .js, .wxml, .wxss 四个文件进行处理。'),
    window: windowSchema.optional(),
    tabBar: tabBarSchema.optional(),
    networkTimeout: networkTimeoutSchema.optional(),
    debug: z.boolean().optional(),
    functionalPages: z.boolean().optional(),
    subpackages: z.array(subpackageSchema).optional(),
    workers: z.string().optional(),
    requiredBackgroundModes: z.array(z.string()).optional(),
    requiredPrivateInfos: z.array(z.string()).optional(),
    plugins: z.object({}).optional(),
    preloadRule: z.object({}).optional(),
    resizable: z.boolean().optional(),
    permission: z.object({}).optional(),
    sitemapLocation: z.string().optional(),
    useExtendedLib: z.object({}).optional(),
    entranceDeclare: z.object({}).optional(),
    darkmode: z.boolean().optional(),
    themeLocation: z.string().optional(),
    lazyCodeLoading: z.string().optional(),
    supportedMaterials: z.object({}).optional(),
    serviceProviderTicket: z.string().optional(),
    embeddedAppIdList: z.array(z.string()).optional(),
    halfPage: z.object({}).optional(),
    debugOptions: z.object({}).optional(),
    resolveAlias: z.object({}).optional(),
    miniApp: z.object({}).optional(),
    static: z.object({}).optional(),
    convertRpxToVw: z.boolean().optional(),
  })
  .merge(appAndPageSharedSchema)
  .describe('全局配置, 小程序根目录下的 app.json 文件用来对微信小程序进行全局配置。')

export const PageSchema = z
  .object({
    backgroundColorContent: z.string().optional().default('#RRGGBBAA'),
    disableScroll: z.boolean().optional().default(false),
    styleIsolation: z.enum(['page-isolated', 'page-apply-shared', 'page-shared']).optional(),
  })
  .merge(appAndPageSharedSchema)
  .merge(pageAndComponentSharedSchema)
  .merge(windowSchema)
  .describe('页面配置, 支持对单个页面进行配置，可以在页面对应的 .json 文件来对本页面的表现进行配置')

export const ComponentSchema = z
  .object({
    component: z.boolean().default(true),
    styleIsolation: z.enum(['isolated', 'apply-shared', 'shared']).optional().default('isolated'),
    componentGenerics: z.object({}).optional(),
  })
  .merge(pageAndComponentSharedSchema)
  .describe('自定义组件配置')

export const AppJsonSchema = zodToJsonSchema(AppSchema)

export const PageJsonSchema = zodToJsonSchema(PageSchema)

export const ComponentJsonSchema = zodToJsonSchema(ComponentSchema)
