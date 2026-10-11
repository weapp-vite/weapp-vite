import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { appendIdeReportEvent } from './ideWarningReport'

interface DiagnosticSession {
  send: (method: string, params: Record<string, unknown>, options: { timeout: number }) => Promise<unknown>
}

interface StyleDiagnosticOptions {
  project: string
  selector: string
  stylesheets: { fileName: string, path: string }[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 失败后读取同一原生页面的实际节点和匹配规则；不改变样式或导航。 */
export async function captureHmrStyleFailure(session: DiagnosticSession, options: StyleDiagnosticOptions) {
  const startedAt = new Date().toISOString()
  const errors: string[] = []
  async function query(method: string, params: Record<string, unknown>) {
    try {
      return await session.send(method, params, { timeout: 1_000 })
    }
    catch (error) {
      errors.push(`${method}: ${error instanceof Error ? error.name : typeof error}`)
      return undefined
    }
  }

  const page = record(await query('App.getCurrentPage', {}))
  const pageId = page?.pageId
  const validPage = typeof pageId === 'number' || typeof pageId === 'string'
  const element = validPage
    ? record(await query('Page.getElement', { pageId, selector: options.selector }))
    : undefined
  const elementId = element?.elementId
  const nodeId = typeof elementId === 'string' && /^\d+$/.test(elementId)
    ? Number(elementId)
    : typeof elementId === 'number' ? elementId : undefined
  let attributes: unknown
  let computedStyles: unknown
  let matchedStyles: unknown
  if (validPage && nodeId !== undefined && Number.isSafeInteger(nodeId) && nodeId >= 0) {
    // Element 命令先校验 pageId 仍为原生栈顶，后续 CSS 查询沿用该页的 DOM nodeId。
    attributes = await query('Element.getAttributes', { pageId, elementId: String(elementId), names: ['class'] })
    computedStyles = await query('Element.getStyles', { pageId, elementId: String(elementId), names: ['background-color', 'color'] })
    // SDK 的 getStyleSheetText 未实现；匹配规则是独立的已加载观察面。
    if (attributes !== undefined || computedStyles !== undefined) {
      matchedStyles = await query('App.CDPCommand', { domain: 'CSS', method: 'getMatchedStylesForNode', params: { nodeId } })
    }
  }

  const stylesheets = await Promise.all(options.stylesheets.map(async (file) => {
    try {
      const source = await readFile(file.path)
      return { fileName: file.fileName, bytes: source.byteLength, sha256: createHash('sha256').update(source).digest('hex') }
    }
    catch (error) {
      errors.push(`stylesheet ${file.fileName}: ${error instanceof Error ? error.name : typeof error}`)
      return { fileName: file.fileName, bytes: null, sha256: null }
    }
  }))
  const snapshot = {
    startedAt,
    completedAt: new Date().toISOString(),
    selector: options.selector,
    page: page ? { pageId: page.pageId, path: page.path } : null,
    element: element ? { elementId: element.elementId, tagName: element.tagName } : null,
    attributes: attributes ?? null,
    computedStyles: computedStyles ?? null,
    matchedStyles: matchedStyles ?? null,
    stylesheets,
    errors,
  }
  try {
    appendIdeReportEvent({ source: 'runtime', kind: 'message', level: 'info', channel: 'hmr-style-failure', project: options.project, text: JSON.stringify(snapshot) })
  }
  catch (error) {
    errors.push(`report sink: ${error instanceof Error ? error.name : typeof error}`)
  }
  try {
    process.stdout.write(`[hmr-style-failure] ${JSON.stringify(snapshot)}\n`)
  }
  catch (error) {
    errors.push(`stdout: ${error instanceof Error ? error.name : typeof error}`)
  }
  return snapshot
}
