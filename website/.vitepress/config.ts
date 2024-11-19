import type { DefaultTheme } from 'vitepress/theme'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitepress'
// @ts-ignore
import typedocSidebar from '../api/typedoc-sidebar.json'

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
      { text: '生成脚手架', link: '/guide/generate' },
      { text: 'JSON 配置文件的智能提示', link: '/guide/json-intelli-sense' },
      { text: '使用 TS/JS 生成 JSON', link: '/guide/json-enhance' },
      { text: 'Wxml 增强', link: '/guide/wxml' },
      { text: 'Wxs 增强', link: '/guide/wxs' },
      { text: '分包加载', link: '/guide/subpackage' },
      { text: '静态资源优化', link: '/guide/image-optimize' },
    ],
  },
  {
    text: '深入 Weapp-vite',
    collapsed: false,
    items: [
      {
        text: 'weapp-vite init 做了什么?',
        link: '/deep/init',
      },
    ],
  },
  { text: '生态集成', link: 'integration/tailwindcss' },
  { text: '配置和 API 参考', link: 'config' },
  { text: '常见问题', link: '/troubleshoot/index' },
  { text: '调试与贡献', link: '/guide/debug' },
  { text: '模块化风格', link: '/guide/module' },
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
    ],
  },
]

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Weapp-vite',
  description: '把现代化的开发模式带入小程序!',
  outDir: 'dist',
  themeConfig: {

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '指引', link: '/guide' },
      { text: '社区', link: '/community/group' },
      { text: '参考', link: '/config' },
      { text: '博客', link: '/blog/release1_7' },
      { text: 'API', link: '/api/' },
    ],
    logo: '/logo.svg',

    sidebar: {
      '/api/': [{
        text: 'API',
        items: typedocSidebar,
      }],
      '/guide/': guideSidebarItems,
      '/deep/': guideSidebarItems,
      '/troubleshoot/': guideSidebarItems,
      '/community/': communitySidebarItems,
      '/integration/': communitySidebarItems,
      '/blog/': [
        {
          text: '最新文章',
          collapsed: false,
          items: [
            // { text: '目录', link: '/blog/' },
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
      ],
      '/config/': [
        {
          text: '参考',
          items: [
            {
              text: 'Weapp-vite 配置项',
              link: '/config/',
            },
            {
              text: '配置 Vite',
              link: 'https://cn.vitejs.dev/config/',
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
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
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
