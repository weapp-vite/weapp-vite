import type { DefaultTheme } from 'vitepress/theme'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitepress'
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons'
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms'
import { createSeoHead, transformPageDataForSeo } from './seo'

function sanitizeSidebarLinks(sidebar?: DefaultTheme.Sidebar): DefaultTheme.Sidebar | undefined {
  const cleanItems = (items?: DefaultTheme.SidebarItem[]): DefaultTheme.SidebarItem[] =>
    (items ?? [])
      .map((item) => {
        const cleanedChildren = item.items ? cleanItems(item.items) : undefined
        const link = typeof item.link === 'string' ? item.link : ''
        const isExternal = /^https?:\/\//.test(link)

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
      Object.entries(sidebar).map(([base, items]) => [base, cleanItems(items as DefaultTheme.SidebarItem[])]),
    )
  }

  return sidebar
}

const guideSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '指引',
    collapsed: false,
    items: [
      {
        text: '什么是 Weapp-vite ?',
        link: '/guide/what-is-weapp-vite',
      },
      { text: '快速开始', link: '/guide/' },
      { text: '目录结构', link: '/guide/directory-structure' },
      { text: '手动集成', link: '/guide/manual-integration' },
    ],
  },
  {
    text: '原生增强',
    collapsed: false,
    items: [
      {
        text: '🔥 Vue SFC 开发',
        link: '/guide/vue-sfc/',
      },
      { text: 'Alias 别名', link: '/guide/alias' },
      { text: '自动构建 npm ', link: '/guide/npm' },
      {
        text: '自动导入组件 ',
        collapsed: false,
        items: [
          { text: '自动导入组件', link: '/guide/auto-import' },
          { text: '自定义 Resolver', link: '/guide/auto-import-resolver' },
        ],
      },
      { text: '自动路由', link: '/guide/auto-routes' },
      { text: '生成脚手架', link: '/guide/generate' },
      { text: 'JSON 配置文件的智能提示', link: '/guide/json-intelli-sense' },
      { text: '使用 TS/JS 生成 JSON', link: '/guide/json-enhance' },
      { text: 'Wxml 增强', link: '/guide/wxml' },
      { text: '🧪 Wxs 增强', link: '/guide/wxs' },
      { text: 'Wxss 样式增强与注意点', link: '/guide/wxss' },
      { text: '分包指南', link: '/guide/subpackage' },
      { text: '共享 Chunk 策略', link: '/guide/chunks' },
      { text: '组件库构建（lib 模式）', link: '/guide/lib-mode' },
      { text: '🧪 Web 兼容矩阵', link: '/guide/web-compat-matrix' },
      { text: '微信小程序插件开发', link: '/guide/plugin' },
      { text: '静态资源的处理与优化', link: '/guide/image-optimize' },
    ],
  },
  { text: '🔥生态集成', link: 'integration/tailwindcss' },
  { text: '配置和 API 参考', link: 'config' },
  { text: '常见问题', link: '/troubleshoot/index' },
  { text: '调试与贡献', link: '/guide/debug' },
  { text: 'SEO/GEO 质量门禁', link: '/guide/seo-governance' },
  { text: '模块化风格', link: '/guide/module' },
  {
    text: '深入 Weapp-vite',
    collapsed: false,
    items: [
      {
        text: 'weapp-vite init 做了什么?',
        link: '/deep/init',
      },
      {
        text: '依赖分析扫描流程',
        link: '/deep/scan',
      },
      {
        text: '配置服务内部结构',
        link: '/deep/config-service',
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
      { text: 'miniprogram-computed 集成', link: '/integration/miniprogram-computed' },
    ],
  },
]

const blogSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '最新文章',
    collapsed: false,
    items: [
      {
        text: 'weapp-vite@6：支持 Vue SFC！',
        link: '/blog/release6',
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
    items: [
      { text: '周边包总览', link: '/packages/' },
    ],
  },
  {
    text: '工程工具',
    collapsed: false,
    items: [
      { text: 'create-weapp-vite（脚手架）', link: '/packages/create-weapp-vite' },
      { text: 'weapp-ide-cli（开发者工具 CLI）', link: '/packages/weapp-ide-cli' },
      { text: 'rolldown-require（配置加载）', link: '/packages/rolldown-require/index.zh' },
      { text: 'vite-plugin-performance（性能分析）', link: '/packages/vite-plugin-performance' },
    ],
  },
  {
    text: '运行时与编译',
    collapsed: false,
    items: [
      { text: '@wevu/compiler（编译底座）', link: '/packages/wevu-compiler' },
      { text: '@wevu/api（跨端 API）', link: '/packages/weapi' },
      { text: '@weapp-vite/web（Web 实验运行时）', link: '/packages/web' },
      { text: '@weapp-vite/volar（IDE 插件）', link: '/packages/volar' },
    ],
  },
  {
    text: '示例与实验',
    collapsed: true,
    items: [
      { text: '@weapp-vite/mcp（MCP 示例）', link: '/packages/mcp' },
    ],
  },
  {
    text: 'rolldown-require (EN)',
    collapsed: true,
    items: [
      { text: 'Why rolldown-require', link: '/packages/rolldown-require/' },
      { text: 'API & options', link: '/packages/rolldown-require/options' },
      { text: 'Loading flow & cache', link: '/packages/rolldown-require/cache' },
    ],
  },
  {
    text: 'rolldown-require (中文)',
    collapsed: true,
    items: [
      { text: '为什么需要 rolldown-require', link: '/packages/rolldown-require/index.zh' },
      { text: 'API 与选项', link: '/packages/rolldown-require/options.zh' },
      { text: '加载流程与缓存', link: '/packages/rolldown-require/cache.zh' },
    ],
  },
]

const wevuSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: 'wevu',
    collapsed: false,
    items: [
      { text: '概览', link: '/wevu/' },
      { text: '快速上手', link: '/wevu/quick-start' },
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
      { text: '运行时与生命周期', link: '/wevu/runtime' },
      { text: 'defineComponent（组件）', link: '/wevu/component' },
      { text: 'Store（状态管理）', link: '/wevu/store' },
      {
        text: 'API 参考',
        collapsed: false,
        items: [
          { text: '总览', link: '/wevu/api-reference/' },
          { text: 'Core API', link: '/wevu/api-reference/core' },
          { text: 'Reactivity API', link: '/wevu/api-reference/reactivity' },
          { text: 'Lifecycle API', link: '/wevu/api-reference/lifecycle' },
          { text: 'Setup Context API', link: '/wevu/api-reference/setup-context' },
          { text: 'Store API', link: '/wevu/api-reference/store' },
          { text: 'Runtime Bridge API', link: '/wevu/api-reference/runtime-bridge' },
          { text: 'Type Reference', link: '/wevu/api-reference/types' },
          { text: '完整 Typedoc（runtime）', link: '/wevu/api/index/index' },
          { text: '完整 Typedoc（compiler）', link: '/wevu/api/compiler/index' },
        ],
      },
      { text: '兼容性与注意事项', link: '/wevu/compatibility' },
      { text: 'Vue 3 兼容性说明（完整）', link: '/wevu/vue3-compat' },
      { text: '从原生小程序迁移到 Vue SFC', link: '/wevu/migration/from-native-to-vue-sfc' },
      { text: 'wevu vs Vue 3（核心差异）', link: '/wevu/vue3-vs-wevu' },
      {
        text: '扩展阅读',
        collapsed: true,
        items: [
          { text: '为什么没有使用 @vue/runtime-core 的 createRenderer 来实现', link: '/wevu/why-not-runtime-core-create-renderer' },
          { text: 'wevu 中的 setData 什么时候触发？', link: '/wevu/when-setdata-triggers' },
        ],
      },
    ],
  },
]

const _handbookSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '教程总览',
    collapsed: false,
    items: [
      { text: '索引', link: '/handbook/' },
      { text: '阅读路线与约定', link: '/handbook/reading-guide' },
    ],
  },
  {
    text: '上手与工程化（weapp-vite）',
    collapsed: false,
    items: [
      { text: '快速开始（教程版）', link: '/handbook/getting-started' },
      { text: '目录结构与分层', link: '/handbook/project-structure' },
      { text: 'Monorepo 与多包协作', link: '/handbook/monorepo' },
      { text: '构建与输出：你应该关心什么', link: '/handbook/build-and-output' },
      { text: '多环境与配置分层', link: '/handbook/env-and-config' },
    ],
  },
  {
    text: 'Vue SFC（wuve）',
    collapsed: false,
    items: [
      { text: 'SFC 总览：映射到小程序', link: '/handbook/sfc/' },
      { text: 'Template：语法与差异点', link: '/handbook/sfc/template' },
      { text: 'Script Setup：推荐范式', link: '/handbook/sfc/script-setup' },
      { text: 'Options API：兼容写法', link: '/handbook/sfc/options-api' },
      { text: 'JSON：<json> 与宏', link: '/handbook/sfc/json' },
      { text: '组件：usingComponents 与拆分', link: '/handbook/sfc/components' },
      { text: '事件与 v-model：绑定策略', link: '/handbook/sfc/events-and-v-model' },
      { text: '样式：wxss / scoped / 预处理器', link: '/handbook/sfc/style' },
      { text: '资源：图片/字体/路径', link: '/handbook/sfc/assets' },
      { text: '生命周期：页面/组件对齐', link: '/handbook/sfc/lifecycle' },
      { text: '表单：受控输入与校验', link: '/handbook/sfc/forms' },
      { text: 'Cookbook：高频场景配方', link: '/handbook/sfc/cookbook' },
    ],
  },
  {
    text: 'wevu（运行时）',
    collapsed: false,
    items: [
      { text: '定位与选择：为什么是 wevu', link: '/handbook/wevu/' },
      { text: '运行时：setup 上下文与更新', link: '/handbook/wevu/runtime' },
      { text: '组件：props/emit/slots 语义', link: '/handbook/wevu/component' },
      { text: 'Store：模式与工程落地', link: '/handbook/wevu/store' },
      { text: 'bindModel：双向绑定方案', link: '/handbook/wevu/bind-model' },
      { text: 'provide/inject：依赖注入', link: '/handbook/wevu/provide-inject' },
      { text: '插件与全局能力', link: '/handbook/wevu/plugins' },
      { text: '测试与 Mock', link: '/handbook/wevu/testing' },
      { text: 'FAQ 与排错', link: '/handbook/wevu/faq' },
    ],
  },
  {
    text: '业务开发（通用）',
    collapsed: false,
    items: [
      { text: '页面与路由（导航）', link: '/handbook/navigation' },
      { text: '网络请求与数据层', link: '/handbook/network' },
      { text: '原生能力调用（wx.*）', link: '/handbook/native-apis' },
      { text: '分包与包体策略', link: '/handbook/subpackages' },
      { text: '监控与埋点', link: '/handbook/observability' },
    ],
  },
  {
    text: '发布与质量',
    collapsed: false,
    items: [
      { text: '性能与体验优化', link: '/handbook/performance' },
      { text: '调试与排错（体系化）', link: '/handbook/debugging' },
      { text: '构建、预览与上传', link: '/handbook/publish' },
      { text: '迁移指南（路线与清单）', link: '/handbook/migration' },
      { text: '参考与索引', link: '/handbook/reference' },
    ],
  },
]

const configSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '配置指南',
    collapsed: false,
    items: [
      { text: '配置概览', link: '/config/' },
      { text: '基础目录与资源收集', link: '/config/paths' },
      { text: '构建输出与兼容', link: '/config/build-and-output' },
      { text: 'JSON 配置', link: '/config/json' },
      { text: 'JS 配置', link: '/config/js' },
      { text: 'Vue SFC 配置', link: '/config/vue' },
      { text: '分包配置', link: '/config/subpackages' },
      { text: 'Worker 配置', link: '/config/worker' },
      { text: '生成脚手架配置', link: '/config/generate' },
      { text: 'npm 配置', link: '/config/npm' },
      { text: 'WXML 配置', link: '/config/wxml' },
      { text: '🧪 WXS 配置', link: '/config/wxs' },
      { text: '自动导入组件配置', link: '/config/auto-import-components' },
      { text: '共享配置', link: '/config/shared' },
      { text: '🧪 Web 运行时配置', link: '/config/web' },
    ],
  },
]
// https://vitepress.dev/reference/site-config
// https://github.com/emersonbottero/vitepress-plugin-mermaid/issues/47
export default defineConfig({
  title: 'Weapp-vite',
  description: '把现代化的开发模式带入小程序!',
  outDir: 'dist',
  // 暂时不生成 /handbook/* 路由：内容回填到 /wevu/vue-sfc 与 /wevu/*（/guide/vue-sfc 仅保留目录）
  srcExclude: ['handbook/**'],
  // CI 环境不包含 gitignore 的 typedoc 产物，仅放行该目录的死链检查。
  ignoreDeadLinks: [/^\/wevu\/api(?:\/|$)/],
  themeConfig: {

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '指引', link: '/guide/' },
      // { text: '教程', link: '/handbook/' }, // 暂时隐藏：内容回填到 /wevu/vue-sfc 与 /wevu/*（/guide/vue-sfc 仅保留目录）
      { text: 'wevu', link: '/wevu/' },
      { text: '社区', link: '/community/group' },
      { text: '周边包', link: '/packages/' },
      // { text: '参考', link: '/config' },
      { text: '迁移', link: '/migration/' },
      { text: '博客', link: blogSidebarItems?.[0]?.items?.[0]?.link as string },
      { text: '配置', link: '/config/' },
    ],
    logo: '/logo.svg',

    sidebar: {
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
      '/packages/': packagesSidebarItems,
      '/wevu/': wevuSidebarItems,
      // '/handbook/': handbookSidebarItems, // 暂时隐藏：内容回填到 /wevu/vue-sfc 与 /wevu/*（/guide/vue-sfc 仅保留目录）
      // '/config/': [
      //   {
      //     text: '参考',
      //     items: [
      //       // {
      //       //   text: 'Weapp-vite 配置项',
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
              text: '从原生小程序迁移到 weapp-vite / wevu',
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
      { icon: 'github', link: 'https://github.com/weapp-vite/weapp-vite' },
    ],
    editLink: {
      pattern: 'https://github.com/weapp-vite/weapp-vite/edit/main/website-weapp-vite/:path',
      text: '为此页提供修改建议',
    },
    outline: {
      label: '本页目录',
      level: [2, 3],
    },
    footer: {
      message: `Released under the MIT License.`,
      copyright: 'Copyright © 2024-present <a target="_blank" ref="nofollow" href="https://github.com/sonofmagic">sonofmagic</a>',
    },
    search: {
      provider: 'local',
    },
  },
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin)
      md.use(copyOrDownloadAsMarkdownButtons)
    },
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
      { async: 'true', src: 'https://www.googletagmanager.com/gtag/js?id=G-89RF58SCYG' },
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
            if (id.includes('mermaid')) {
              return 'vendor-mermaid'
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
})
