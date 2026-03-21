import type { DefaultTheme } from 'vitepress/theme'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitepress'
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
} from 'vitepress-plugin-group-icons'
import llmstxt, {
  copyOrDownloadAsMarkdownButtons,
} from 'vitepress-plugin-llms'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { createSeoHead, transformPageDataForSeo } from './seo'
import { WEAPI_CAPABILITY_GROUPS } from './shared/weapiCapabilities'

const vueSharedEsmPath = fileURLToPath(
  new URL(
    '../node_modules/@vue/shared/dist/shared.esm-bundler.js',
    import.meta.url,
  ),
)
const atomGitSocialSvg = readFileSync(
  fileURLToPath(new URL('../public/AtomGit.svg', import.meta.url)),
  'utf8',
).replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="currentColor"')
const EXTERNAL_LINK_REGEX = /^https?:\/\//

function sanitizeSidebarLinks(
  sidebar?: DefaultTheme.Sidebar,
): DefaultTheme.Sidebar | undefined {
  const cleanItems = (
    items?: DefaultTheme.SidebarItem[],
  ): DefaultTheme.SidebarItem[] =>
    (items ?? [])
      .map((item) => {
        const cleanedChildren = item.items ? cleanItems(item.items) : undefined
        const link = typeof item.link === 'string' ? item.link : ''
        const isExternal = EXTERNAL_LINK_REGEX.test(link)

        if (isExternal && (!cleanedChildren || cleanedChildren.length === 0)) {
          return null
        }

        return {
          ...item,
          ...(cleanedChildren ? { items: cleanedChildren } : {}),
        }
      })
      .filter(Boolean) as DefaultTheme.SidebarItem[]

  if (Array.isArray(sidebar)) {
    return cleanItems(sidebar)
  }

  if (sidebar && typeof sidebar === 'object') {
    return Object.fromEntries(
      Object.entries(sidebar).map(([base, items]) => [
        base,
        cleanItems(items as DefaultTheme.SidebarItem[]),
      ]),
    )
  }

  return sidebar
}

const guideSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '开始使用',
    collapsed: false,
    items: [
      { text: '快速开始', link: '/guide/' },
      {
        text: '什么是 Weapp-vite ?',
        link: '/guide/what-is-weapp-vite',
      },
      { text: 'CLI', link: '/guide/cli' },
      { text: 'AI 协作', link: '/guide/ai' },
      { text: '目录结构', link: '/guide/directory-structure/' },
      { text: '手动集成', link: '/guide/manual-integration' },
    ],
  },
  {
    text: '原生增强',
    collapsed: false,
    items: [
      {
        text: 'Vue SFC 开发',
        link: '/guide/vue-sfc/',
      },
      { text: 'Alias 别名', link: '/guide/alias' },
      { text: '自动构建 npm', link: '/guide/npm' },
      { text: '生成脚手架', link: '/guide/generate' },
      { text: '自动路由', link: '/guide/auto-routes' },
      { text: '页面 Layout', link: '/guide/layouts' },
      {
        text: '自动导入组件',
        collapsed: false,
        items: [
          { text: '自动导入组件', link: '/guide/auto-import' },
          { text: '自定义 Resolver', link: '/guide/auto-import-resolver' },
        ],
      },
      { text: 'WXML 增强', link: '/guide/wxml' },
      { text: 'WXSS 注意点', link: '/guide/wxss' },
      { text: 'JSON 智能提示', link: '/guide/json-intelli-sense' },
      { text: 'TS/JS 生成 JSON', link: '/guide/json-enhance' },
      { text: '分包指南', link: '/guide/subpackage' },
      { text: '共享 Chunk', link: '/guide/chunks' },
      { text: '组件库构建', link: '/guide/lib-mode' },
      { text: '静态资源优化', link: '/guide/image-optimize' },
      { text: '插件开发', link: '/guide/plugin' },
      { text: '宿主识别', link: '/guide/vite-plugin-host' },
    ],
  },
  {
    text: '实验能力',
    collapsed: false,
    items: [
      { text: '多平台构建', link: '/guide/multi-platform' },
      { text: 'WXS 增强', link: '/guide/wxs' },
      { text: 'Web 兼容矩阵', link: '/guide/web-compat-matrix' },
    ],
  },
  { text: '生态集成', link: 'integration/tailwindcss' },
  { text: '配置与 API', link: 'config' },
  { text: '常见问题', link: '/troubleshoot/index' },
  { text: '调试与贡献', link: '/guide/debug' },
  { text: '模块化风格', link: '/guide/module' },
  {
    text: '深入 Weapp-vite',
    collapsed: false,
    items: [
      {
        text: 'Init 做了什么',
        link: '/deep/init',
      },
      {
        text: '依赖扫描',
        link: '/deep/scan',
      },
      {
        text: '配置服务',
        link: '/deep/config-service',
      },
    ],
  },
]

const directoryStructureSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '目录结构',
    collapsed: false,
    items: [
      { text: '总览', link: '/guide/directory-structure/' },
      {
        text: '根目录',
        collapsed: false,
        items: [
          {
            text: 'vite.config.ts',
            link: '/guide/directory-structure/vite-config',
          },
          {
            text: 'project.config.json',
            link: '/guide/directory-structure/project-config',
          },
          {
            text: 'package.json',
            link: '/guide/directory-structure/package-json',
          },
          { text: 'public/', link: '/guide/directory-structure/public' },
        ],
      },
      {
        text: '源码根目录',
        collapsed: false,
        items: [
          {
            text: '&lt;srcRoot&gt;/',
            link: '/guide/directory-structure/src-root',
          },
          { text: 'layouts/', link: '/guide/directory-structure/layouts' },
        ],
      },
      {
        text: '应用入口',
        collapsed: false,
        items: [
          { text: 'app.(js|ts)', link: '/guide/directory-structure/app-ts' },
          { text: 'app.vue', link: '/guide/directory-structure/app-vue' },
          {
            text: 'app.json(.js|.ts)?',
            link: '/guide/directory-structure/app-json',
          },
          {
            text: 'app.(css|scss|wxss|...)',
            link: '/guide/directory-structure/app-style',
          },
          {
            text: 'custom-tab-bar/',
            link: '/guide/directory-structure/custom-tab-bar',
          },
          { text: 'app-bar/', link: '/guide/directory-structure/app-bar' },
        ],
      },
      {
        text: '页面与组件',
        collapsed: false,
        items: [
          { text: 'pages/', link: '/guide/directory-structure/pages' },
          {
            text: 'components/',
            link: '/guide/directory-structure/components',
          },
        ],
      },
      {
        text: '分包与共享',
        collapsed: false,
        items: [
          {
            text: '&lt;subPackageRoot&gt;/',
            link: '/guide/directory-structure/subpackages',
          },
          { text: 'shared/', link: '/guide/directory-structure/shared' },
          { text: 'utils/', link: '/guide/directory-structure/utils' },
          { text: 'workers/', link: '/guide/directory-structure/workers' },
        ],
      },
      {
        text: '生成文件',
        collapsed: false,
        items: [
          {
            text: '类型声明文件',
            link: '/guide/directory-structure/generated-files',
          },
        ],
      },
    ],
  },
]

const communitySidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '社区',
    collapsed: false,
    items: [
      {
        text: '优秀案例展示',
        link: '/community/showcase',
      },
      {
        text: '加入技术交流群',
        link: '/community/group',
      },
    ],
  },
  {
    text: '生态集成',
    collapsed: false,
    items: [
      { text: 'Tailwindcss 集成', link: '/integration/tailwindcss' },
      { text: 'Vue-mini 集成', link: '/integration/vue-mini' },
      { text: 'Tdesign 集成', link: '/integration/tdesign' },
      { text: 'Vant Weapp 集成', link: '/integration/vant' },
      {
        text: 'miniprogram-computed 集成',
        link: '/integration/miniprogram-computed',
      },
    ],
  },
]

const blogSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '最新文章',
    collapsed: false,
    items: [
      {
        text: 'Weapp-vite@6：支持 Vue SFC！',
        link: '/blog/release6',
      },
      {
        text: 'Weapp-vite@6 原理拆解',
        link: '/blog/release6-principles',
      },
      {
        text: '4.0 版本发布',
        link: '/blog/release4',
      },
      {
        text: '1.7.x 更新',
        link: '/blog/release1_7',
      },
      {
        text: 'Weapp-vite 发布了!',
        link: '/blog/announce',
      },
    ],
  },
]

const packagesSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '总览',
    collapsed: false,
    items: [{ text: '周边包总览', link: '/packages/' }],
  },
  {
    text: '工程工具',
    collapsed: false,
    items: [
      {
        text: 'create-weapp-vite（脚手架）',
        link: '/packages/create-weapp-vite',
      },
      {
        text: 'weapp-ide-cli（开发者工具 CLI）',
        link: '/packages/weapp-ide-cli',
      },
      {
        text: 'rolldown-require（配置加载）',
        link: '/packages/rolldown-require/index.zh',
      },
      {
        text: 'vite-plugin-performance（性能分析）',
        link: '/packages/vite-plugin-performance',
      },
    ],
  },
  {
    text: '运行时与编译',
    collapsed: false,
    items: [
      { text: '@wevu/compiler（编译底座）', link: '/packages/wevu-compiler' },
      {
        text: '@wevu/api（跨端 API）',
        collapsed: false,
        items: [
          { text: '总览', link: '/packages/weapi/' },
          { text: '兼容总览', link: '/packages/weapi/compat-overview' },
          { text: 'API 全量清单', link: '/packages/weapi/wx-method-list' },
          {
            text: '支付宝兼容矩阵',
            link: '/packages/weapi/alipay-compat-matrix',
          },
          {
            text: '抖音兼容矩阵',
            link: '/packages/weapi/douyin-compat-matrix',
          },
          { text: '兼容差异说明', link: '/packages/weapi/gap-notes' },
          {
            text: '平台独有 API 清单',
            link: '/packages/weapi/platform-only-methods',
          },
        ],
      },
      { text: '@weapp-vite/web（Web 实验运行时）', link: '/packages/web' },
      { text: '@weapp-vite/volar（IDE 插件）', link: '/packages/volar' },
    ],
  },
  {
    text: 'AI 与实验',
    collapsed: false,
    items: [{ text: '@weapp-vite/mcp（MCP 服务）', link: '/packages/mcp' }],
  },
  {
    text: 'rolldown-require (EN)',
    collapsed: true,
    items: [
      { text: 'Why rolldown-require', link: '/packages/rolldown-require/' },
      { text: 'API & options', link: '/packages/rolldown-require/options' },
      {
        text: 'Loading flow & cache',
        link: '/packages/rolldown-require/cache',
      },
    ],
  },
  {
    text: 'rolldown-require (中文)',
    collapsed: true,
    items: [
      {
        text: '为什么需要 rolldown-require',
        link: '/packages/rolldown-require/index.zh',
      },
      { text: 'API 与选项', link: '/packages/rolldown-require/options.zh' },
      { text: '加载流程与缓存', link: '/packages/rolldown-require/cache.zh' },
    ],
  },
]

const wevuSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: 'Wevu',
    collapsed: false,
    items: [
      { text: '概览', link: '/wevu/' },
      { text: '快速上手', link: '/wevu/quick-start' },
      { text: '运行时与生命周期', link: '/wevu/runtime' },
      { text: 'defineComponent（组件）', link: '/wevu/component' },
      { text: 'Store（状态管理）', link: '/wevu/store' },
      {
        text: 'API 参考',
        link: '/wevu/api/',
        target: '_blank',
        rel: 'noreferrer',
      },
    ],
  },
  {
    text: 'Vue SFC 开发',
    collapsed: false,
    items: [
      { text: '总览', link: '/wevu/vue-sfc/' },
      { text: '基础与组成', link: '/wevu/vue-sfc/basics' },
      { text: '配置与宏', link: '/wevu/vue-sfc/config' },
      { text: '模板与指令', link: '/wevu/vue-sfc/template' },
      { text: '示例', link: '/wevu/vue-sfc/examples' },
      { text: '调试与排错', link: '/wevu/vue-sfc/troubleshoot' },
    ],
  },
  {
    text: 'Namespace 导出',
    collapsed: false,
    items: [
      { text: 'wevu/api', link: '/wevu/api-package' },
      { text: 'wevu/fetch', link: '/wevu/fetch' },
      { text: 'wevu/router', link: '/wevu/router' },
      { text: 'wevu/jsx-runtime', link: '/wevu/jsx-runtime' },
    ],
  },
  {
    text: '进阶与迁移',
    collapsed: false,
    items: [
      {
        text: '兼容性与注意事项',
        link: '/wevu/compatibility',
      },
      { text: 'Vue 3 兼容性说明（完整）', link: '/wevu/vue3-compat' },
      {
        text: '从原生小程序迁移到 Vue SFC',
        link: '/wevu/migration/from-native-to-vue-sfc',
      },
      { text: 'Wevu vs Vue 3（核心差异）', link: '/wevu/vue3-vs-wevu' },
    ],
  },
  {
    text: '扩展阅读',
    collapsed: false,
    items: [
      {
        text: '为什么没有使用 @vue/runtime-core 的 createRenderer 来实现',
        link: '/wevu/why-not-runtime-core-create-renderer',
      },
      {
        text: 'Wevu 中的 setData 什么时候触发？',
        link: '/wevu/when-setdata-triggers',
      },
    ],
  },
]

const wevuApiSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: 'API 首页',
    collapsed: false,
    items: [{ text: 'API 首页', link: '/wevu/api/' }],
  },
  {
    text: 'Global API',
    collapsed: false,
    items: [{ text: 'Core API', link: '/wevu/api/core' }],
  },
  {
    text: 'Composition API',
    collapsed: false,
    items: [
      { text: 'Reactivity API', link: '/wevu/api/reactivity' },
      { text: 'Lifecycle API', link: '/wevu/api/lifecycle' },
      { text: 'Setup Context API', link: '/wevu/api/setup-context' },
    ],
  },
  {
    text: 'Runtime API',
    collapsed: false,
    items: [
      { text: 'Store API', link: '/wevu/api/store' },
      { text: 'Runtime Bridge API', link: '/wevu/api/runtime-bridge' },
    ],
  },
  {
    text: 'Type API',
    collapsed: false,
    items: [{ text: 'Type Reference', link: '/wevu/api/types' }],
  },
]

const weapiSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '@wevu/api',
    collapsed: false,
    items: [
      { text: 'Docs 首页', link: '/packages/weapi/' },
      { text: 'wpi 概览', link: '/packages/weapi/overview' },
      { text: '兼容总览', link: '/packages/weapi/compat-overview' },
      {
        text: 'API 全量清单',
        link: '/packages/weapi/wx-method-list',
        collapsed: false,
        items: WEAPI_CAPABILITY_GROUPS.map(group => ({
          text: group.label,
          link: `/packages/weapi/wx-method-list/${group.key}`,
        })),
      },
      {
        text: '支付宝兼容矩阵',
        link: '/packages/weapi/alipay-compat-matrix',
        collapsed: true,
        items: WEAPI_CAPABILITY_GROUPS.map(group => ({
          text: group.label,
          link: `/packages/weapi/alipay-compat-matrix/${group.key}`,
        })),
      },
      {
        text: '抖音兼容矩阵',
        link: '/packages/weapi/douyin-compat-matrix',
        collapsed: true,
        items: WEAPI_CAPABILITY_GROUPS.map(group => ({
          text: group.label,
          link: `/packages/weapi/douyin-compat-matrix/${group.key}`,
        })),
      },
      { text: '兼容差异说明', link: '/packages/weapi/gap-notes' },
      {
        text: '平台独有 API 清单',
        link: '/packages/weapi/platform-only-methods',
      },
    ],
  },
]

const _handbookSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '先看这里',
    collapsed: false,
    items: [
      { text: 'handbook 是什么', link: '/handbook/' },
      { text: '怎么阅读这套教程', link: '/handbook/reading-guide' },
    ],
  },
  {
    text: '第 1 步：先把项目跑起来',
    collapsed: false,
    items: [
      { text: '30 分钟快速开始', link: '/handbook/getting-started' },
      { text: '目录结构怎么放最顺手', link: '/handbook/project-structure' },
      { text: '环境变量与配置怎么分层', link: '/handbook/env-and-config' },
      { text: '构建产物到底长什么样', link: '/handbook/build-and-output' },
      { text: 'Monorepo 与多包协作', link: '/handbook/monorepo' },
    ],
  },
  {
    text: '第 2 步：开始写 Vue SFC',
    collapsed: false,
    items: [
      { text: '先建立 SFC 心智模型', link: '/handbook/sfc/' },
      { text: 'Template：先学哪些写法', link: '/handbook/sfc/template' },
      {
        text: 'Script Setup：推荐日常范式',
        link: '/handbook/sfc/script-setup',
      },
      { text: 'JSON：页面配置放哪里', link: '/handbook/sfc/json' },
      { text: '组件：拆分、导入与注册', link: '/handbook/sfc/components' },
      {
        text: '事件与 v-model：怎么绑定最稳',
        link: '/handbook/sfc/events-and-v-model',
      },
      { text: '样式：scoped、预处理器与约束', link: '/handbook/sfc/style' },
      { text: '资源：图片、字体、路径', link: '/handbook/sfc/assets' },
      { text: '生命周期：页面与组件怎么对齐', link: '/handbook/sfc/lifecycle' },
      { text: '表单：输入、校验与受控写法', link: '/handbook/sfc/forms' },
      { text: '原生 WXML：什么时候保留', link: '/handbook/sfc/native-wxml' },
      {
        text: 'Options API：兼容项目怎么写',
        link: '/handbook/sfc/options-api',
      },
      { text: '高频场景配方', link: '/handbook/sfc/cookbook' },
    ],
  },
  {
    text: '第 3 步：再理解 Wevu 运行时',
    collapsed: false,
    items: [
      { text: '为什么要用 Wevu', link: '/handbook/wevu/' },
      { text: '运行时：setup、hooks 与更新', link: '/handbook/wevu/runtime' },
      { text: '组件：props、emit、slots', link: '/handbook/wevu/component' },
      { text: 'Store：状态怎么放更合理', link: '/handbook/wevu/store' },
      { text: 'bindModel：双向绑定方案', link: '/handbook/wevu/bind-model' },
      {
        text: 'provide / inject：依赖注入',
        link: '/handbook/wevu/provide-inject',
      },
      { text: '插件与全局能力', link: '/handbook/wevu/plugins' },
      { text: '测试与 Mock', link: '/handbook/wevu/testing' },
      { text: 'FAQ 与排错', link: '/handbook/wevu/faq' },
    ],
  },
  {
    text: '第 4 步：开始做业务',
    collapsed: false,
    items: [
      { text: '页面跳转与路由参数', link: '/handbook/navigation' },
      { text: '网络请求与数据层', link: '/handbook/network' },
      { text: '原生能力调用与封装', link: '/handbook/native-apis' },
      { text: '分包与包体策略', link: '/handbook/subpackages' },
      { text: '监控、埋点与线上可观测性', link: '/handbook/observability' },
    ],
  },
  {
    text: '第 5 步：上线前后要做什么',
    collapsed: false,
    items: [
      { text: '性能与体验优化', link: '/handbook/performance' },
      { text: '调试与排错（按层定位）', link: '/handbook/debugging' },
      { text: '构建、预览与上传', link: '/handbook/publish' },
      { text: '从旧项目迁移过来', link: '/handbook/migration' },
      { text: '参考入口与速查索引', link: '/handbook/reference' },
    ],
  },
]

const configSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '配置总览',
    collapsed: false,
    items: [{ text: '配置概览', link: '/config/' }],
  },
  {
    text: '项目基础',
    collapsed: false,
    items: [
      { text: '基础目录与资源收集', link: '/config/paths' },
      { text: '构建输出与兼容', link: '/config/build-and-output' },
      { text: 'TypeScript 支持文件', link: '/config/typescript' },
    ],
  },
  {
    text: '应用结构与路由',
    collapsed: false,
    items: [
      { text: 'Route Rules 与 Layout', link: '/config/route-rules' },
      { text: '分包配置', link: '/config/subpackages' },
      { text: 'Worker 配置', link: '/config/worker' },
    ],
  },
  {
    text: 'Vue / Wevu 与模板编译',
    collapsed: false,
    items: [
      { text: 'JSON 配置', link: '/config/json' },
      { text: 'JS 配置', link: '/config/js' },
      { text: 'Vue SFC 配置', link: '/config/vue' },
      { text: 'WXML 配置', link: '/config/wxml' },
      { text: '🧪 WXS 配置', link: '/config/wxs' },
      { text: '共享配置', link: '/config/shared' },
    ],
  },
  {
    text: '组件、依赖与产物',
    collapsed: false,
    items: [
      { text: '自动导入组件配置', link: '/config/auto-import-components' },
      { text: '共享 Chunk 配置', link: '/config/chunks' },
      { text: 'npm 配置', link: '/config/npm' },
      { text: '库模式配置', link: '/config/lib' },
      { text: '生成脚手架配置', link: '/config/generate' },
    ],
  },
  {
    text: '实验能力',
    collapsed: false,
    items: [{ text: '🧪 Web 运行时配置', link: '/config/web' }],
  },
]
// https://vitepress.dev/reference/site-config
// https://github.com/emersonbottero/vitepress-plugin-mermaid/issues/47
export default withMermaid(
  defineConfig({
    title: 'Weapp-vite',
    description:
      '面向小程序的现代工程化工具链，覆盖开发、构建、Vue SFC、Wevu、自动化、MCP 与多平台能力。',
    srcExclude: ['dist/**'],
    outDir: 'dist',
    // CI 环境不包含 gitignore 的 typedoc 产物，仅放行该目录的死链检查。
    ignoreDeadLinks: [/^\/wevu\/api(?:\/|$)/],
    themeConfig: {
      // https://vitepress.dev/reference/default-theme-config
      nav: [
        { text: '指引', link: '/guide/' },
        { text: '教程', link: '/handbook/' },
        { text: '配置', link: '/config/' },
        { text: 'Wevu', link: '/wevu/' },
        { text: 'Wevu API', link: '/wevu/api/' },
        { text: 'Wpi', link: '/packages/weapi/' },
        { text: '周边包', link: '/packages/' },
        { text: 'AI', link: '/ai' },
        { text: '社区', link: '/community/group' },
        { text: '迁移', link: '/migration/' },
        {
          text: '博客',
          link: blogSidebarItems?.[0]?.items?.[0]?.link as string,
        },
      ],
      logo: '/logo.svg',

      sidebar: {
        '/guide/directory-structure/': directoryStructureSidebarItems,
        //  [{
        //   text: '配置',
        //   collapsed: false,
        //   items: typedocSidebar,
        // }],
        '/guide/': guideSidebarItems,
        '/deep/': guideSidebarItems,
        '/troubleshoot/': guideSidebarItems,
        '/community/': communitySidebarItems,
        '/integration/': communitySidebarItems,
        '/blog/': blogSidebarItems,
        '/config/': configSidebarItems,
        '/packages/weapi/': weapiSidebarItems,
        '/packages/': packagesSidebarItems,
        '/wevu/api/': wevuApiSidebarItems,
        '/wevu/api-reference/': wevuApiSidebarItems,
        '/wevu/': wevuSidebarItems,
        '/handbook/': _handbookSidebarItems,
        // '/config/': [
        //   {
        //     text: '参考',
        //     items: [
        //       // {
        //       //   text: 'weapp-vite 配置项',
        //       //   link: '/config/',
        //       // },
        //       {
        //         text: '配置 Vite',
        //         link: 'https://cn.vitejs.dev/config/',
        //       },
        //     ],
        //   },
        // ],
        '/migration/': [
          {
            text: '迁移指南',
            items: [
              {
                text: '索引',
                link: '/migration/index',
              },
              {
                text: '从原生小程序迁移到 Weapp-vite / Wevu',
                link: '/wevu/migration/from-native-to-vue-sfc',
              },
              {
                text: '从 v5.x 迁移到 v6.x',
                link: '/migration/v6',
              },
              {
                text: '从 v4.x 迁移到 v5.x',
                link: '/migration/v5',
              },
              {
                text: '从 v3.x 迁移到 v4.x',
                link: '/migration/v4',
              },
              {
                text: '从 v2.x 迁移到 v3.x',
                link: '/migration/v3',
              },
            ],
          },
        ],
      },

      socialLinks: [
        {
          ariaLabel: 'AtomGit',
          icon: { svg: atomGitSocialSvg },
          link: 'https://atomgit.com/sonofmagic/weapp-vite',
        },
        { icon: 'github', link: 'https://github.com/weapp-vite/weapp-vite' },
      ],
      editLink: {
        pattern:
          'https://github.com/weapp-vite/weapp-vite/edit/main/website-weapp-vite/:path',
        text: '为此页提供修改建议',
      },
      outline: {
        label: '本页目录',
        level: [2, 3],
      },
      footer: {
        message: `Released under the MIT License.`,
        copyright:
          'Copyright © 2024-present <a target="_blank" ref="nofollow" href="https://github.com/sonofmagic">sonofmagic</a>',
      },
      search: {
        provider: 'local',
      },
    },
    markdown: {
      languageAlias: {
        env: 'ini',
        wxml: 'html',
      },
      languageLabel: {
        env: 'ENV',
        wxml: 'WXML',
      },
      config(md) {
        md.use(groupIconMdPlugin)
        md.use(copyOrDownloadAsMarkdownButtons)
      },
    },
    mermaid: {
      theme: 'default',
    },
    transformHead: ({ pageData }) => createSeoHead(pageData),
    transformPageData(pageData) {
      transformPageDataForSeo(pageData)
    },
    head: [
      ['meta', { name: 'theme-color', content: '#95ec69' }],
      ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
      ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
      // google analytics start
      [
        'script',
        {
          async: 'true',
          src: 'https://www.googletagmanager.com/gtag/js?id=G-89RF58SCYG',
        },
      ],
      [
        'script',
        {},
        `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-89RF58SCYG');`,
      ],
      //  // google analytics end
      [
        'script',
        {},
        `var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?b19c15773e6c3ca95c3fb6087148a99b";
  var s = document.getElementsByTagName("script")[0]; 
  s.parentNode.insertBefore(hm, s);
})();`,
      ],
    ],
    sitemap: {
      hostname: 'https://vite.icebreaker.top',
    },
    lastUpdated: true,
    vite: {
      server: {
        host: true,
      },
      resolve: {
        alias: {
          // Fix SSR build error: mark.js deep import without extension in ESM
          'mark.js/src/vanilla.js': 'mark.js/dist/mark.es6.js',
          // Element Plus references @vue/shared directly in some ESM entries.
          // Map it explicitly to the browser ESM build to keep docs build stable under pnpm.
          '@vue/shared': vueSharedEsmPath,
        },
      },
      build: {
        // Relax warning threshold and split heavy vendors to multiple chunks
        chunkSizeWarningLimit: 2048,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) {
                return undefined
              }

              if (id.includes('element-plus')) {
                return 'vendor-element-plus'
              }
              if (id.includes('echarts')) {
                return 'vendor-echarts'
              }
              if (id.includes('gridstack')) {
                return 'vendor-gridstack'
              }
              if (id.includes('vue-echarts')) {
                return 'vendor-vue-echarts'
              }
              if (id.includes('@iconify-json/mdi')) {
                return 'vendor-icons'
              }
              // Mermaid runtime is loaded by VitePress docs pipeline. Keep both in one chunk
              // to avoid circular manual chunk graph.
              if (id.includes('mermaid')) {
                return 'vendor-vitepress'
              }
              if (id.includes('@shikijs') || id.includes('shiki')) {
                return 'vendor-shiki'
              }
              if (id.includes('vitepress')) {
                return 'vendor-vitepress'
              }
              if (id.includes('vue')) {
                return 'vendor-vue'
              }
              // fallback vendor bucket
              return 'vendor'
            },
          },
        },
      },
      // https://github.com/vuejs/vitepress/issues/3145
      // ssr: {
      //   noExternal: ['element-plus', 'gridstack', 'vue-echarts', 'echarts'],
      // },
      plugins: [
        llmstxt({
          excludeBlog: false,
          ignoreFiles: ['dist/**'],
          sidebar: configSidebar => sanitizeSidebarLinks(configSidebar),
        }),
        AutoImport({
          resolvers: [ElementPlusResolver()],
        }),
        Components({
          resolvers: [ElementPlusResolver()],
        }),
        groupIconVitePlugin(),
      ],
      css: {
        preprocessorOptions: {
          scss: {
            silenceDeprecations: ['legacy-js-api'],
            api: 'modern-compiler',
          },
        },
      },
    },
  }),
)
