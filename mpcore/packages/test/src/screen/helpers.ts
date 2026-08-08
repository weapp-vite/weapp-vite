import type { HeadlessTestingLogicalNode } from '@mpcore/simulator'

export type TextMatcher = string | RegExp

export interface RoleQueryOptions {
  name?: TextMatcher
}

export function matchesText(value: string, matcher: TextMatcher) {
  if (typeof matcher === 'string') {
    return value === matcher
  }
  matcher.lastIndex = 0
  return matcher.test(value)
}

export function implicitRole(node: HeadlessTestingLogicalNode) {
  const explicit = node.attrs.role ?? node.attrs['aria-role']
  if (explicit) {
    return explicit
  }
  if (node.tag === 'button') {
    return 'button'
  }
  if (node.tag === 'textarea') {
    return 'textbox'
  }
  if (node.tag === 'input') {
    const type = node.attrs.type ?? 'text'
    if (type === 'checkbox') {
      return 'checkbox'
    }
    if (type === 'radio') {
      return 'radio'
    }
    return 'textbox'
  }
  if (node.tag === 'image') {
    return 'img'
  }
  return undefined
}

export function accessibleName(node: HeadlessTestingLogicalNode) {
  return node.attrs['aria-label']
    ?? node.attrs.placeholder
    ?? node.attrs.alt
    ?? node.text.trim()
}

export function collectElements(root: HeadlessTestingLogicalNode, result: HeadlessTestingLogicalNode[] = []) {
  if (root.type === 'element') {
    result.push(root)
  }
  root.children.forEach(child => collectElements(child, result))
  return result
}

export function findNodeById(root: HeadlessTestingLogicalNode, nodeId: string): HeadlessTestingLogicalNode | undefined {
  if (root.nodeId === nodeId) {
    return root
  }
  for (const child of root.children) {
    const match = findNodeById(child, nodeId)
    if (match) {
      return match
    }
  }
  return undefined
}
