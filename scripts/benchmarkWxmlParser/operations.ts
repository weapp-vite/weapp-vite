import type { Node } from '../../packages/wxml/src/types'
import type { Arm, Fixture, Operation, WxmlApi } from './types'
import { DECODED_XML_PARSE_OPTIONS, RAW_XML_PARSE_OPTIONS } from './parserContract'

interface DomNode {
  type: string
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: DomNode[]
  startIndex?: number | null
  endIndex?: number | null
}
interface HtmlApi {
  parseDocument: (source: string, options: Record<string, unknown>) => DomNode
  Parser: new (handlers: Record<string, (...args: any[]) => void>, options: Record<string, unknown>) => { end: (source: string) => void }
}
interface Consumer {
  parseWxml?: (source: any) => unknown
  parseWxsTemplateDocument?: (source: string) => unknown
}
export interface Dependencies {
  wxml: WxmlApi
  html: HtmlApi
  render: (node: any, options: Record<string, unknown>) => string
  consumers?: Record<string, Record<Arm, Consumer>>
}

const serializeOptions = { xmlMode: true, encodeEntities: 'utf8', selfClosingTags: true }
const options = (fixture: Fixture) => ({ platform: fixture.platform as 'weapp', syntax: 'xml' as const })

function stable(value: unknown): string {
  const output: string[] = []
  const stack: Array<{ value: unknown } | { raw: string }> = [{ value }]
  while (stack.length) {
    const task = stack.pop()!
    if ('raw' in task) {
      output.push(task.raw)
      continue
    }
    const item = task.value
    if (!item || typeof item !== 'object') {
      output.push(JSON.stringify(item) ?? 'null')
      continue
    }
    const entries = Array.isArray(item) ? item.map((entry, index) => [String(index), entry] as const) : Object.entries(item).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b))
    output.push(Array.isArray(item) ? '[' : '{')
    stack.push({ raw: Array.isArray(item) ? ']' : '}' })
    for (let i = entries.length - 1; i >= 0; i--) {
      if (i < entries.length - 1) {
        stack.push({ raw: ',' })
      }
      stack.push({ value: entries[i]![1] })
      if (!Array.isArray(item)) {
        stack.push({ raw: `${JSON.stringify(entries[i]![0])}:` })
      }
    }
  }
  return output.join('')
}

function domRange(node: DomNode): [number, number] {
  if (!Number.isInteger(node.startIndex) || !Number.isInteger(node.endIndex)
    || node.startIndex! < 0 || node.endIndex! < node.startIndex!) {
    throw new Error(`Missing or invalid common source range on ${node.type}.`)
  }
  return [node.startIndex!, node.endIndex! + 1]
}

function domProjection(root: DomNode, withRanges = false): unknown {
  const output: unknown[] = []
  const stack: Array<DomNode | null> = [root]
  while (stack.length) {
    const node = stack.pop()!
    if (!node) {
      output.push(['end'])
      continue
    }
    const range = withRanges && node.type !== 'root' ? [domRange(node)] : []
    if (node.attribs) {
      output.push(['element', node.name, node.attribs, ...range])
      stack.push(null)
    }
    else if (node.type === 'cdata') {
      output.push(['cdata', node.children?.map(child => child.data ?? '').join(''), ...range])
      continue
    }
    else if (node.type !== 'root') {
      output.push([node.type, node.data, ...range])
      continue
    }
    for (let i = (node.children?.length ?? 0) - 1; i >= 0; i--) {
      stack.push(node.children![i]!)
    }
  }
  return output
}

function documentProjection(nodes: readonly Node[]): unknown {
  const output: unknown[] = []
  const stack: Array<Node | null> = [...nodes].reverse()
  while (stack.length) {
    const node = stack.pop()!
    if (!node) {
      output.push(['end'])
      continue
    }
    if (node.kind === 'element') {
      const attributes: Record<string, string> = Object.create(null)
      for (const attribute of node.attributes) {
        if (!Object.hasOwn(attributes, attribute.name)) {
          attributes[attribute.name] = attribute.value ?? ''
        }
      }
      output.push(['element', node.name, attributes, [node.start, node.end]])
      stack.push(null)
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]!)
      }
    }
    else if (node.kind === 'comment') {
      output.push(['comment', node.data.slice(4, -3), [node.start, node.end]])
    }
    else if (node.kind === 'cdata') {
      output.push(['cdata', node.data.slice(9, -3), [node.start, node.end]])
    }
    else if (node.kind === 'declaration') {
      output.push(['directive', node.data.slice(1, node.data.endsWith('?>') ? -2 : -1), [node.start, node.end]])
    }
    else {
      output.push(['text', node.data, [node.start, node.end]])
    }
  }
  return output
}

function assertDiagnostics(result: { diagnostics: readonly { severity: string, code: string, start: number }[] }) {
  const errors = result.diagnostics.filter(row => row.severity === 'error')
  if (errors.length) {
    throw new Error(`Candidate diagnostics: ${errors.map(row => `${row.code}@${row.start}`).join(', ')}`)
  }
}

function mutateDom(root: DomNode, source: string) {
  let elementChanged = false
  let textChanged = false
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()!
    if (!elementChanged && node.attribs) {
      node.attribs['data-wxml-benchmark'] = 'edited'
      elementChanged = true
    }
    if (node.type === 'cdata') {
      continue
    }
    if (!textChanged && node.type === 'text') {
      const [start, end] = domRange(node)
      if (end <= source.length && source.slice(start, end).trim()) {
        node.data = 'wxml benchmark text'
        textChanged = true
      }
    }
    for (let i = (node.children?.length ?? 0) - 1; i >= 0; i--) {
      stack.push(node.children![i]!)
    }
  }
}

export function createOperations(dependencies: Dependencies, fixtures: Fixture[]): Operation[] {
  const { wxml, html, render } = dependencies
  const baselineTrees = new Map(fixtures.map(file => [file.id, html.parseDocument(file.source, DECODED_XML_PARSE_OPTIONS)]))
  const candidateTrees = new Map(fixtures.map(file => [file.id, wxml.parse(file.source, options(file))]))
  const scan = (fixture: Fixture, arm: Arm) => {
    const tags: Array<[string, Record<string, string>]> = []
    if (arm === 'candidate') {
      const result = wxml.scan(fixture.source, options(fixture))
      for (const token of result.tokens) {
        if (token.kind === 'tag' && !token.closing) {
          const attributes: Record<string, string> = Object.create(null)
          for (const attribute of token.attributes) {
            if (!Object.hasOwn(attributes, attribute.name)) {
              attributes[attribute.name] = wxml.decodeAttribute(attribute.value ?? '', 'xml', true, attribute.quote)
            }
          }
          tags.push([token.name, attributes])
        }
      }
    }
    else {
      new html.Parser({ onopentag: (name: string, attributes: Record<string, string>) => tags.push([name, attributes]) }, DECODED_XML_PARSE_OPTIONS).end(fixture.source)
    }
    return tags
  }
  const parse = (fixture: Fixture, arm: Arm) => arm === 'candidate'
    ? wxml.parse(fixture.source, options(fixture))
    : html.parseDocument(fixture.source, RAW_XML_PARSE_OPTIONS)
  const canonical = (fixture: Fixture, arm: Arm) => arm === 'candidate'
    ? wxml.serialize(candidateTrees.get(fixture.id)!, { mode: 'canonical' })
    : render(baselineTrees.get(fixture.id)!, serializeOptions)
  const edit = (fixture: Fixture, arm: Arm) => {
    if (arm === 'baseline') {
      const tree = html.parseDocument(fixture.source, DECODED_XML_PARSE_OPTIONS)
      mutateDom(tree, fixture.source)
      return render(tree, serializeOptions)
    }
    let elementChanged = false
    let textChanged = false
    const tree = wxml.edit(wxml.parse(fixture.source, options(fixture)), (editor) => {
      if (!elementChanged && editor.node.kind === 'element') {
        editor.setAttribute('data-wxml-benchmark', 'edited')
        elementChanged = true
      }
      if (!textChanged && editor.node.kind === 'text' && editor.node.data.trim()) {
        editor.replaceText('wxml benchmark text')
        textChanged = true
      }
    })
    return wxml.serialize(tree, { mode: 'canonical' })
  }
  const compareMarkup = (fixture: Fixture, operation: (fixture: Fixture, arm: Arm) => unknown) => {
    const baseline = stable(domProjection(html.parseDocument(String(operation(fixture, 'baseline')), DECODED_XML_PARSE_OPTIONS)))
    const candidate = stable(domProjection(html.parseDocument(String(operation(fixture, 'candidate')), DECODED_XML_PARSE_OPTIONS)))
    return { equal: baseline === candidate, baseline, candidate }
  }
  const operations: Operation[] = [
    { id: 'scan', comparable: true, run: scan, verify: (fixture) => {
      assertDiagnostics(wxml.scan(fixture.source, options(fixture)))
      const baseline = stable(scan(fixture, 'baseline'))
      const candidate = stable(scan(fixture, 'candidate'))
      return { equal: baseline === candidate, baseline, candidate }
    } },
    { id: 'parse', comparable: true, run: parse, verify: (fixture) => {
      const document = candidateTrees.get(fixture.id)!
      assertDiagnostics(document)
      const baseline = stable(domProjection(html.parseDocument(fixture.source, RAW_XML_PARSE_OPTIONS), true))
      const candidate = stable(documentProjection(document.children))
      return { equal: baseline === candidate, baseline, candidate }
    } },
    { id: 'canonical', comparable: true, run: canonical, verify: fixture => compareMarkup(fixture, canonical) },
    { id: 'parse-edit-serialize', comparable: true, run: edit, verify: fixture => compareMarkup(fixture, edit) },
    { id: 'preserve-noop', comparable: false, run: (fixture, arm) => arm === 'candidate'
      ? wxml.serialize(candidateTrees.get(fixture.id)!, { mode: 'preserve' })
      : render(baselineTrees.get(fixture.id)!, serializeOptions), verify: (fixture) => {
      const candidate = wxml.serialize(candidateTrees.get(fixture.id)!, { mode: 'preserve' })
      return { equal: fixture.source === candidate, baseline: fixture.source, candidate }
    } },
  ]
  for (const [name, arms] of Object.entries(dependencies.consumers ?? {})) {
    const run = (fixture: Fixture, arm: Arm) => name === 'scanner'
      ? arms[arm].parseWxml!({ source: fixture.source, platform: fixture.platform, excludeComponent: () => false })
      : name === 'web' ? arms[arm].parseWxml!(fixture.source) : arms[arm].parseWxsTemplateDocument!(fixture.source)
    operations.push({ id: `consumer-${name}`, comparable: true, run, verify: (fixture) => {
      const projection = (arm: Arm) => name === 'simulator' ? domProjection(run(fixture, arm) as DomNode) : run(fixture, arm)
      const baseline = stable(projection('baseline'))
      const candidate = stable(projection('candidate'))
      return { equal: baseline === candidate, baseline, candidate }
    } })
  }
  return operations
}
