export interface ClassAttributeElement {
  getAttribute: (name: string) => string | null
  removeAttribute: (name: string) => void
  setAttribute: (name: string, value: string) => void
}

interface RenderRootLike {
  childNodes?: ArrayLike<unknown>
}

function parseClassTokens(value: string | null | undefined) {
  return new Set((value ?? '').split(/\s+/).filter(Boolean))
}

function writeTokens(element: ClassAttributeElement, name: string, tokens: Set<string>) {
  const value = Array.from(tokens).join(' ')
  if (value) {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value)
    }
  }
  else if (element.getAttribute(name) !== null) {
    element.removeAttribute(name)
  }
}

function isClassAttributeElement(value: unknown): value is ClassAttributeElement & { tagName?: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as ClassAttributeElement).getAttribute === 'function'
    && typeof (value as ClassAttributeElement).setAttribute === 'function',
  )
}

function resolveVirtualRootElement(root: RenderRootLike) {
  for (const child of Array.from(root.childNodes ?? [])) {
    if (!isClassAttributeElement(child)) {
      continue
    }
    if (child.tagName?.toLowerCase() === 'style') {
      continue
    }
    return child
  }
  return undefined
}

/**
 * 将 virtualHost 根节点的 class 暴露到 Web 自定义元素宿主。
 *
 * 微信的虚拟宿主不会形成样式边界，父组件可以通过 external class
 * 和 deep 选择器命中子组件根节点。Web 仍使用 Shadow DOM 保留 slot
 * 投影，因此需要把根节点的 class token 同步到宿主来还原该选择器语义。
 */
export function syncVirtualHostClasses(
  host: ClassAttributeElement,
  root: RenderRootLike,
  ownedRuntimeTokens: Set<string>,
) {
  const rootElement = resolveVirtualRootElement(root)
  const nextRuntimeTokens = parseClassTokens(rootElement?.getAttribute('class'))
  const hostTokens = parseClassTokens(host.getAttribute('class'))

  for (const token of ownedRuntimeTokens) {
    hostTokens.delete(token)
  }
  ownedRuntimeTokens.clear()
  for (const token of nextRuntimeTokens) {
    if (!hostTokens.has(token)) {
      ownedRuntimeTokens.add(token)
    }
    hostTokens.add(token)
  }

  writeTokens(host, 'class', hostTokens)
}

/**
 * 移除 runtime 为 virtualHost 同步的 class，并保留调用方宿主 class。
 */
export function clearVirtualHostClasses(
  host: ClassAttributeElement,
  ownedRuntimeTokens: Set<string>,
) {
  if (ownedRuntimeTokens.size === 0) {
    return
  }
  const hostTokens = parseClassTokens(host.getAttribute('class'))
  for (const token of ownedRuntimeTokens) {
    hostTokens.delete(token)
  }
  writeTokens(host, 'class', hostTokens)
  ownedRuntimeTokens.clear()
}

/**
 * 清除 runtime 暴露的 CSS part，并保留组件模板声明的 part。
 */
export function clearVirtualHostParts(
  rootElement: ClassAttributeElement | undefined,
  ownedPartTokens: Set<string>,
) {
  if (!rootElement || ownedPartTokens.size === 0) {
    return
  }
  const partTokens = parseClassTokens(rootElement.getAttribute('part'))
  for (const token of ownedPartTokens) {
    partTokens.delete(token)
  }
  writeTokens(rootElement, 'part', partTokens)
  ownedPartTokens.clear()
}

/**
 * 将 virtualHost 根 class 同步为 CSS part，使父组件可以跨 Shadow DOM
 * 对子组件根节点应用 deep 样式。
 */
export function syncVirtualHostParts(
  root: RenderRootLike,
  previousRootElement: ClassAttributeElement | undefined,
  ownedPartTokens: Set<string>,
) {
  const rootElement = resolveVirtualRootElement(root)
  if (previousRootElement && previousRootElement !== rootElement) {
    clearVirtualHostParts(previousRootElement, ownedPartTokens)
  }
  if (!rootElement) {
    ownedPartTokens.clear()
    return undefined
  }

  const partTokens = parseClassTokens(rootElement.getAttribute('part'))
  for (const token of ownedPartTokens) {
    partTokens.delete(token)
  }
  ownedPartTokens.clear()
  for (const token of parseClassTokens(rootElement.getAttribute('class'))) {
    if (!partTokens.has(token)) {
      ownedPartTokens.add(token)
    }
    partTokens.add(token)
  }
  writeTokens(rootElement, 'part', partTokens)
  return rootElement
}
