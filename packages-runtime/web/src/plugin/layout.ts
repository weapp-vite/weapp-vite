import type { LayoutEntry } from './types'

function collectLayoutPropKeys(layouts: LayoutEntry[]) {
  const keys = new Set<string>()
  for (const layout of layouts) {
    if (!layout.template) {
      continue
    }
    const matches = layout.template.matchAll(/\{\{\s*([a-z_$][\w$]*)/gi)
    for (const match of matches) {
      if (match[1] && match[1] !== 'item' && match[1] !== 'index') {
        keys.add(match[1])
      }
    }
  }
  return [...keys]
}

export function wrapPageTemplate(source: string, layouts: LayoutEntry[]) {
  if (!layouts.length) {
    return source
  }
  const propKeys = collectLayoutPropKeys(layouts)
  const branches = layouts.map((layout, index) => {
    const condition = index === 0
      ? `!__wv_page_layout_name || __wv_page_layout_name === '${layout.name}'`
      : `__wv_page_layout_name === '${layout.name}'`
    const attrs = propKeys.map(key => `${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}="{{(__wv_page_layout_props&&__wv_page_layout_props.${key})}}"`).join(' ')
    const open = attrs ? `<${layout.tag} ${attrs}>` : `<${layout.tag}>`
    const directive = index === 0 ? 'wx:if' : 'wx:elif'
    return `<block ${directive}="{{${condition}}}">${open}${source}</${layout.tag}></block>`
  })
  return `${branches.join('')}<block wx:else>${source}</block>`
}
