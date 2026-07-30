import type { HeadlessTestingNodeHandle } from '../view'
import type { HeadlessTestingWaitOptions } from './pageWait'

export interface HeadlessTestingPageQueryOptions extends HeadlessTestingWaitOptions {
  componentSelectors?: string[]
  fallback?: boolean
  routeOnly?: boolean
}

export interface HeadlessTestingRenderedOptions extends HeadlessTestingWaitOptions {
  componentSelectors?: string[]
  dataset?: Record<string, boolean | number | string>
  predicate?: (wxml: string) => boolean
  selector?: string
  text?: string
}

export interface HeadlessTestingRenderedNodeSnapshot {
  bottom?: number
  dataset?: Record<string, unknown>
  height?: number
  id?: string
  left?: number
  right?: number
  top?: number
  width?: number
}

export type HeadlessTestingRenderedSelectorNodesSnapshot
  = Record<string, HeadlessTestingRenderedNodeSnapshot[]>

export interface HeadlessTestingRenderedPageAccess {
  assertActive: () => void
  findAll: (selector: string) => Promise<HeadlessTestingNodeHandle[]>
  waitFor: (ms?: number) => Promise<void>
  wxml: () => Promise<string>
}

const DEFAULT_RENDERED_WAIT_TIMEOUT = 15_000
const DEFAULT_RENDERED_WAIT_INTERVAL = 10

function normalizeSelector(selector: string) {
  const normalizedSelector = selector.trim()
  if (!normalizedSelector) {
    throw new Error('Selector must be a non-empty string in headless testing runtime.')
  }
  return normalizedSelector
}

function matchesDataset(
  node: HeadlessTestingRenderedNodeSnapshot,
  expected: Record<string, boolean | number | string> | undefined,
) {
  if (!expected) {
    return true
  }
  const dataset = node.dataset ?? {}
  return Object.entries(expected).every(([key, value]) => String(dataset[key] ?? '') === String(value))
}

async function pollUntil<T>(
  access: HeadlessTestingRenderedPageAccess,
  check: () => Promise<T | null>,
  errorMessage: string,
  options: HeadlessTestingRenderedOptions,
) {
  const timeout = Number.isFinite(options.timeout)
    ? Math.max(0, Math.trunc(options.timeout ?? DEFAULT_RENDERED_WAIT_TIMEOUT))
    : DEFAULT_RENDERED_WAIT_TIMEOUT
  const interval = Number.isFinite(options.interval)
    ? Math.max(1, Math.trunc(options.interval ?? DEFAULT_RENDERED_WAIT_INTERVAL))
    : DEFAULT_RENDERED_WAIT_INTERVAL
  const deadline = Date.now() + timeout

  while (true) {
    const result = await check()
    if (result != null) {
      return result
    }
    if (Date.now() >= deadline) {
      throw new Error(errorMessage)
    }
    await access.waitFor(interval)
  }
}

export async function readRenderedNodes(
  access: HeadlessTestingRenderedPageAccess,
  selector: string,
  _options: HeadlessTestingPageQueryOptions = {},
): Promise<HeadlessTestingRenderedNodeSnapshot[]> {
  access.assertActive()
  const normalizedSelector = normalizeSelector(selector)
  const nodes = await access.findAll(normalizedSelector)
  return await Promise.all(nodes.map(async (node) => {
    // Headless 只表达逻辑节点已渲染，不提供 CSS 布局；非零尺寸用于兼容 automator 的渲染就绪探测。
    const left = 0
    const top = 0
    const width = 1
    const height = 1
    return {
      bottom: top + height,
      dataset: await node.dataset(),
      height,
      id: await node.attr('id') ?? '',
      left,
      right: left + width,
      top,
      width,
    }
  }))
}

export async function readRenderedSelectorNodes(
  access: HeadlessTestingRenderedPageAccess,
  selectors: string[],
  options: HeadlessTestingPageQueryOptions = {},
): Promise<HeadlessTestingRenderedSelectorNodesSnapshot> {
  access.assertActive()
  const normalizedSelectors = selectors
    .map(selector => String(selector || '').trim())
    .filter(Boolean)
  const result: HeadlessTestingRenderedSelectorNodesSnapshot = {}
  for (const selector of normalizedSelectors) {
    result[selector] = await readRenderedNodes(access, selector, options)
  }
  return result
}

export async function waitForRenderedPage(
  access: HeadlessTestingRenderedPageAccess,
  options: HeadlessTestingRenderedOptions = {},
) {
  access.assertActive()
  if (options.selector) {
    const selector = normalizeSelector(options.selector)
    return await pollUntil(
      access,
      async () => {
        const nodes = await readRenderedNodes(access, selector, options)
        return nodes.some(node => matchesDataset(node, options.dataset))
          ? JSON.stringify({ nodes, selector })
          : null
      },
      `Timed out waiting page rendered: selector=${selector} dataset=${JSON.stringify(options.dataset ?? {})}`,
      options,
    )
  }

  return await pollUntil(
    access,
    async () => {
      const wxml = await access.wxml()
      const normalizedWxml = wxml.trim()
      if (options.predicate?.(wxml)) {
        return wxml
      }
      if (options.text && normalizedWxml.includes(options.text)) {
        return wxml
      }
      if (!options.text && !options.predicate && normalizedWxml && normalizedWxml !== '<text></text>') {
        return wxml
      }
      return null
    },
    options.text
      ? `Timed out waiting page rendered: text=${options.text}`
      : options.predicate
        ? 'Timed out waiting page rendered: predicate=true'
        : 'Timed out waiting page rendered: non-empty wxml',
    options,
  )
}
