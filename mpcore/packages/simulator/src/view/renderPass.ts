import type { HeadlessComponentInstance } from '../runtime/componentInstance'
import type { HeadlessPageInstance } from '../runtime/pageInstance'
import type { DomNodeLike, RuntimeSlotContent } from '../runtime/render/types'

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
}

export function createRenderPass(propertyUpdate = false): RenderPass {
  return {
    seenComponentScopes: new Set(),
    componentRoots: new Map(),
    slotDeclarations: new Map(),
    renderedSlots: new Map(),
    hasUnprojectedSlots: false,
    propertyUpdate,
  }
}

export function createPageRenderPass(page: HeadlessPageInstance, cache: ComponentCache) {
  return createRenderPass(initializedPages.get(cache)?.has(page) ?? false)
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
