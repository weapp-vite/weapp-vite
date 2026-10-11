import type { DomNodeLike, RuntimeRenderScope } from '../runtime/render/types'
import type { RenderPass } from './renderPass'

const inspectionChildren = new WeakMap<DomNodeLike, DomNodeLike[]>()
const inspectionParents = new WeakMap<DomNodeLike, DomNodeLike>()
const emptyChildren: DomNodeLike[] = []

export function getInspectionChildren(node: DomNodeLike) {
  return inspectionChildren.get(node) ?? node.children ?? emptyChildren
}

export function getInspectionParent(node: DomNodeLike) {
  return inspectionParents.get(node) ?? node.parent ?? null
}

function collectRenderedNodes(node: DomNodeLike, nodes: Set<DomNodeLike>) {
  if (nodes.has(node)) {
    return
  }
  nodes.add(node)
  for (const child of node.children ?? emptyChildren) {
    collectRenderedNodes(child, nodes)
  }
}

/** 原生检查器保留未投影声明；可见 DOM、WXML 和事件父链不因此增加节点。 */
export function registerInspectionTrees(root: DomNodeLike, pass: RenderPass, scopes: ReadonlyMap<string, RuntimeRenderScope>) {
  if (!pass.hasUnprojectedSlots) {
    return
  }
  const rendered = new Set<DomNodeLike>()
  collectRenderedNodes(root, rendered)
  const candidates = new Map<DomNodeLike, DomNodeLike>()
  for (const [entries, group] of pass.slotDeclarations) {
    if (scopes.get(group.scopeId)?.hostNode !== group.parent) {
      continue
    }
    const host = pass.componentRoots.get(group.scopeId)
    if (!host) {
      continue
    }
    for (const entry of entries) {
      for (const node of pass.renderedSlots.get(entry) ?? emptyChildren) {
        candidates.set(node, host)
      }
    }
  }

  const nested = new Set<DomNodeLike>()
  const visited = new Set<DomNodeLike>()
  const indexChildren = (node: DomNodeLike) => {
    if (visited.has(node)) {
      return
    }
    visited.add(node)
    for (const child of node.children ?? emptyChildren) {
      nested.add(child)
      if (!rendered.has(child)) {
        inspectionParents.set(child, node)
      }
      indexChildren(child)
    }
  }
  for (const node of candidates.keys()) {
    indexChildren(node)
  }
  for (const [node, host] of candidates) {
    // 转发内容只保留最外层未投影分支，避免同一 Leaf 在声明队列和转发出口各出现一次。
    if (rendered.has(node) || nested.has(node) || node === host) {
      continue
    }
    let children = inspectionChildren.get(host)
    if (!children) {
      children = [...(host.children ?? emptyChildren)]
      inspectionChildren.set(host, children)
    }
    children.push(node)
    inspectionParents.set(node, host)
  }
}
