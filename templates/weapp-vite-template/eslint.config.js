import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker({
  ignores: [
    'CHANGELOG.md',
    'README.md',
    'dist/**',
    'node_modules/**',
    '.turbo/**',
    '.weapp-vite/**',
    'project.config.json',
    'project.private.config.json',
  ],
  languageOptions: {
    globals: {
      wx: true,
      Page: true,
      App: true,
      Component: true,
      getApp: true,
      getCurrentPages: true,
      WechatMiniprogram: true,
    },
  },
})
