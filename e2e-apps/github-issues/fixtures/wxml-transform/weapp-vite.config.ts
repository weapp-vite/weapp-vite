import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  build: { minify: false },
  weapp: {
    srcRoot: 'src',
    autoImportComponents: false,
    vue: { template: { htmlTagToWxml: true } },
    wxml: {
      remove: { attr: ['data-clean'] },
      transform: async (code, ctx) => ctx.edit(code, (node) => {
        if (node.tagName === 'view')
          node.removeAttribute('data-testid')
        if (node.tagName === 'text' && node.hasAttribute('data-use-view')) {
          node.renameTag('view')
          node.removeAttribute('data-use-view')
          node.setAttribute('data-literal', '中文 & "单\'双" \\ {{literal}}')
          node.setAttribute('data-number', 42)
          node.setAttribute('data-bool', false)
          node.setAttribute('data-expression', { expression: 'label' })
        }
        if (node.tagName === 'button') {
          node.renameAttribute('data-track', 'data-analytics')
          node.setAttribute('disabled', false)
          node.setAttribute('hover-class', 'none')
        }
      }),
    },
  },
})
