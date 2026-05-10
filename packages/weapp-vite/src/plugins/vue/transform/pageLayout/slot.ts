const SLOT_OPEN_TAG_RE = /<slot\b([^>]*)>/gi
const DEFAULT_SLOT_NAME_RE = /(?:^|\s)name\s*=/

export type LayoutSlotTemplateKind = 'app-shell' | 'page-layout'

export function hasDefaultSlotTemplate(template: string | undefined) {
  if (!template) {
    return false
  }

  for (const match of template.matchAll(SLOT_OPEN_TAG_RE)) {
    const attrs = match[1] ?? ''
    if (!DEFAULT_SLOT_NAME_RE.test(attrs)) {
      return true
    }
  }

  return false
}

export function assertTemplateHasDefaultSlot(options: {
  filename: string
  kind: LayoutSlotTemplateKind
  template: string | undefined
}) {
  if (hasDefaultSlotTemplate(options.template)) {
    return
  }

  if (options.kind === 'app-shell') {
    throw new Error(`${options.filename} 中 app.vue <template> 必须包含默认 <slot />，否则页面内容无法渲染到应用外壳内。`)
  }

  throw new Error(`${options.filename} 对应的 layout template 必须包含默认 <slot />，否则页面内容无法渲染到布局内。`)
}
