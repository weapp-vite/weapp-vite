import type { TemplateNodeLike, TemplateRenderState } from './templateRuntime'
import type { WxsModuleBindings } from './wxs'
import { createTemplateRenderState } from './templateRuntime'

export function createImportedTemplateState<T extends TemplateNodeLike>(
  root: T,
  filePath: string,
  loadImport: (owner: string, source: string) => { root: T, filePath: string },
  loadWxs?: (owner: string, node: T) => unknown,
): TemplateRenderState<T> {
  const documents = new Map<string, { state: TemplateRenderState<T>, exports: Map<string, T> }>()
  const definitionScopes = new Map<T, Map<string, T>>()
  const definitionWxsScopes = new Map<T, WxsModuleBindings>()
  const collect = (node: T, owner: string) => {
    const existing = documents.get(owner)
    if (existing) {
      return existing
    }
    const state = createTemplateRenderState(node)
    const wxsModules: WxsModuleBindings = Object.create(null)
    const ownDefinitions = new Map(state.definitions)
    const document = { state, exports: ownDefinitions }
    documents.set(owner, document)
    const visit = (child: T) => {
      if (child.name === 'wxs' && loadWxs) {
        const name = child.attribs?.module
        if (!name || !/^[a-z_$][\w$]*$/i.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)) {
          throw new Error(`Invalid WXS module name in ${owner}: ${String(name)}`)
        }
        if (Object.hasOwn(wxsModules, name)) {
          throw new Error(`Duplicate WXS module in ${owner}: ${name}`)
        }
        wxsModules[name] = loadWxs(owner, child)
        return
      }
      if (child.name === 'import' && child.attribs?.src) {
        const imported = loadImport(owner, child.attribs.src)
        const importedDocument = collect(imported.root, imported.filePath)
        for (const [name, definition] of importedDocument.exports) {
          state.definitions.set(name, definition)
        }
      }
      for (const nested of child.children ?? []) {
        visit(nested as T)
      }
    }
    visit(node)
    if (Object.keys(wxsModules).length) {
      state.wxsModules = wxsModules
    }
    for (const [name, definition] of ownDefinitions) {
      state.definitions.set(name, definition)
      definitionScopes.set(definition, state.definitions)
      if (state.wxsModules) {
        definitionWxsScopes.set(definition, state.wxsModules)
      }
    }
    state.definitionScopes = definitionScopes
    state.definitionWxsScopes = definitionWxsScopes
    return document
  }
  return collect(root, filePath).state
}
