import { defineConfig } from 'weapp-vite/config'
import { solidTemplatePlugin } from './solidTemplatePlugin'

export default defineConfig({
  build: {
    minify: true,
  },
  plugins: [solidTemplatePlugin({
    templates: [
      'pages/index/template.tsx',
      'pages/detail/template.tsx',
      'pages/update/template.tsx',
    ],
  })],
  weapp: {
    hmr: {
      runtime: 'classic',
    },
    srcRoot: 'src',
  },
})
