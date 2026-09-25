import type { WxmlTransformNode } from 'weapp-vite/config'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  build: { minify: false },
  weapp: {
    srcRoot: 'src',
    autoImportComponents: false,
    vue: { template: { htmlTagToWxml: true } },
    wxml: {
      remove: { attr: ['data-clean'] },
      validate: async (_, ctx) => ctx.walk((node) => {
        const report = (message: string) => ctx.report({ severity: 'error', message, location: node.location })
        if (node.getAttribute('data-subtree-visited')?.rawValue !== '{{true}}' || node.hasAttribute('data-remove-subtree')) {
          report('所有保留标签必须经过一次子树编辑')
        }
        if (node.getAttribute('id')?.rawValue === 'subtree' && !node.children.some(child => child.tagName === 'button')) {
          report('校验子树必须保留按钮')
        }
        if (node.hasAttribute('data-clean') || node.hasAttribute('data-use-view')) {
          report('校验必须观察转换和清理完成后的模板')
        }
        if (node.getAttribute('id')?.rawValue === 'renamed'
          && (node.tagName !== 'view' || node.getAttribute('data-number')?.rawValue !== '{{42}}')) {
          report('标签与数值属性必须先完成转换')
        }
        if (node.tagName === 'button' && (!node.hasAttribute('data-analytics') || !node.hasAttribute('bindtap'))) {
          report('最终模板必须保留埋点与点击事件')
        }
      }),
      transform: async (code, ctx) => {
        const editNode = (node: WxmlTransformNode) => {
          if (node.hasAttribute('data-remove-subtree')) {
            node.remove()
            return
          }
          if (node.hasAttribute('data-subtree-visited'))
            throw new Error('subtree processed twice')
          node.setAttribute('data-subtree-visited', true)
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
        }
        return ctx.edit(code, async (node) => {
          for (const child of node.children) {
            if (child.tagName === 'text')
              child.setAttribute('data-direct-child', true)
          }
          editNode(node)
          await node.walk(editNode)
          node.skipChildren()
        })
      },
    },
  },
})
