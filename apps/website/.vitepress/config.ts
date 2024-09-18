import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  outDir: '../../dist',
  title: 'icebreaker\'s monorepo',
  description: 'icebreaker\'s monorepo. upgrade your monorepo',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '使用手册', link: '/' },
      { text: '一些思考', link: '/thinking' },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/sonofmagic/monorepo-template' },
    ],
    outline: {
      label: '目录',
      level: [2, 3],
    },
    logo: '/logo.jpg',
    sidebar: {
      '/': [
        { text: '使用手册', link: '/' },
        { text: '一些思考', link: 'thinking' },
      ],
    },
  },
})
