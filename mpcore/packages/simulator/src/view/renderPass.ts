import type { HeadlessComponentInstance } from '../runtime/componentInstance'
import type { HeadlessPageInstance } from '../runtime/pageInstance'
import type { DomNodeLike, RuntimeSlotContent } from '../runtime/render/types'
import { getAttachmentBindingRevision } from '../host/attachmentBindingUpdates'

interface SlotDeclarationGroup {
  parent: DomNodeLike
  scopeId: string
}

type ComponentCache = ReadonlyMap<string, HeadlessComponentInstance>

const initializedPages = new WeakMap<ComponentCache, WeakSet<HeadlessPageInstance>>()

export interface RenderPass {
  seenComponentScopes: Set<string>
  componentRoots: Map<string, DomNodeLike>
  slotDeclarations: Map<RuntimeSlotContent[], SlotDeclarationGroup>
  renderedSlots: Map<RuntimeSlotContent, DomNodeLike[]>
  hasUnprojectedSlots: boolean
  propertyUpdate: boolean
  bindingUpdate: ReturnType<typeof getAttachmentBindingRevision>
  bindingRevision: number
}

export function createRenderPass(propertyUpdate = false, parent?: RenderPass): RenderPass {
  return {
    seenComponentScopes: new Set(),
    componentRoots: new Map(),
    slotDeclarations: new Map(),
    renderedSlots: new Map(),
    hasUnprojectedSlots: false,
    propertyUpdate,
    bindingUpdate: parent?.bindingUpdate,
    bindingRevision: parent?.bindingUpdate?.revision ?? 0,
  }
}

export function createPageRenderPass(page: HeadlessPageInstance, cache: ComponentCache) {
  const pass = createRenderPass(initializedPages.get(cache)?.has(page) ?? false)
  pass.bindingUpdate = getAttachmentBindingRevision(page)
  pass.bindingRevision = pass.bindingUpdate?.revision ?? 0
  return pass
}

export function isRenderPassStale(pass: RenderPass) {
  return pass.bindingUpdate !== undefined && pass.bindingUpdate.revision !== pass.bindingRevision
}

export function markPageTreeConstructed(page: HeadlessPageInstance, cache: ComponentCache) {
  // 首棵声明树构造完成后，生命周期回调和后续 setData 使用原生更新阶段的事件连接时序。
  let pages = initializedPages.get(cache)
  if (!pages) {
    pages = new WeakSet()
    initializedPages.set(cache, pages)
  }
  pages.add(page)
}

export function registerSlotDeclarations(pass: RenderPass, slots: Map<string, RuntimeSlotContent[]>, parent: DomNodeLike, scopeId: string) {
  for (const entries of slots.values()) {
    if (!pass.slotDeclarations.has(entries)) {
      pass.slotDeclarations.set(entries, { parent, scopeId })
    }
  }
}
