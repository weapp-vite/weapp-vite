import type { DefaultTheme } from 'vitepress/theme'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitepress'
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons'
import llmstxt, { copyOrDownloadAsMarkdownButtons } from 'vitepress-plugin-llms'
import { withMermaid } from 'vitepress-plugin-mermaid'
// @ts-ignore
import typedocSidebar from '../api/typedoc-sidebar.json'

for (const element of typedocSidebar) {
  element.collapsed = false
}

typedocSidebar.push(
  // @ts-ignore
  {
    text: '参考',
    items: [
      {
        text: '配置 Vite',
        link: 'https://cn.vitejs.dev/config/',
      },
    ],
  },
)

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
    ],
  },
  {
    text: '原生增强',
    collapsed: false,
    items: [
      { text: 'Alias 别名', link: '/guide/alias' },
      { text: '自动构建 npm ', link: '/guide/npm' },
      { text: '自动导入组件 ', link: '/guide/auto-import' },
      { text: '自动路由', link: '/guide/auto-routes' },
      { text: '生成脚手架', link: '/guide/generate' },
      { text: 'JSON 配置文件的智能提示', link: '/guide/json-intelli-sense' },
      { text: '使用 TS/JS 生成 JSON', link: '/guide/json-enhance' },
      { text: 'Wxml 增强', link: '/guide/wxml' },
      { text: 'Wxs 增强', link: '/guide/wxs' },
      { text: 'Wxss 样式增强与注意点', link: '/guide/wxss' },
      { text: '分包指南', link: '/guide/subpackage' },
      { text: '微信小程序插件开发', link: '/guide/plugin' },
      { text: '静态资源的处理与优化', link: '/guide/image-optimize' },
    ],
  },
  { text: '🔥生态集成', link: 'integration/tailwindcss' },
  { text: '配置和 API 参考', link: 'config' },
  { text: '常见问题', link: '/troubleshoot/index' },
  { text: '调试与贡献', link: '/guide/debug' },
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

const configSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: '配置指南',
    collapsed: false,
    items: [
      { text: '配置概览', link: '/config/' },
      { text: '基础目录与脚手架', link: '/config/paths-and-generators' },
      { text: 'JSON 别名与路径解析', link: '/config/json-and-alias' },
      { text: '分包与 Worker 策略', link: '/config/subpackages-and-worker' },
      { text: 'npm 构建与依赖策略', link: '/config/npm-and-deps' },
      { text: '增强能力与调试工具', link: '/config/enhance-and-debug' },
    ],
  },
]
// https://vitepress.dev/reference/site-config
// https://github.com/emersonbottero/vitepress-plugin-mermaid/issues/47
export default withMermaid(defineConfig({
  title: 'Weapp-vite',
  description: '把现代化的开发模式带入小程序!',
  outDir: 'dist',
  themeConfig: {

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '指引', link: '/guide' },
      { text: '社区', link: '/community/group' },
      // { text: '参考', link: '/config' },
      { text: '迁移', link: '/migration/index' },
      { text: '博客', link: blogSidebarItems?.[0]?.items?.[0]?.link as string },
      { text: '配置', link: '/config' },
    ],
    logo: '/logo.svg',

    sidebar: {
      '/api/': typedocSidebar,
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
    // @ts-ignore
    codeTransformers: [transformerTwoslash()],
    config(md) {
      md.use(groupIconMdPlugin)
      md.use(copyOrDownloadAsMarkdownButtons)
    },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#95ec69' }],
    ['meta', { property: 'og:url', content: 'https://vite.icebreaker.top/' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Weapp-vite - 把现代化的开发模式带入小程序开发吧!' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Weapp-vite - 把现代化的开发模式带入小程序开发吧!',
      },
    ],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://vite.icebreaker.top/logo.png',
      },
    ],
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
    // https://github.com/vuejs/vitepress/issues/3145
    // ssr: {
    //   noExternal: ['element-plus', 'gridstack', 'vue-echarts', 'echarts'],
    // },
    plugins: [
      llmstxt(),
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
