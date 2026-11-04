import type { ParseOptions } from '../../../packages/wxml/src/types'
import type { TemplateApi } from './types'
import { treeEntries } from './tree'
import { equal, invariant } from './types'
import { classifyXmlSubset, xmlSubsetContract } from './xmlSubset'

interface XmlHandlers {
  onopentagname: (name: string) => void
  onattribute: (name: string, value: string) => void
  onopentag: (name: string) => void
  onclosetag: (name: string) => void
  ontext: (data: string) => void
  oncomment: (data: string) => void
  oncdatastart: () => void
  oncdataend: () => void
}

interface XmlParser { readonly startIndex: number, readonly endIndex: number, end: (source: string) => void }
export type XmlParserConstructor = new (handlers: XmlHandlers, options: { xmlMode: true, decodeEntities: true, recognizeSelfClosing: true }) => XmlParser

export interface XmlDifferentialSummary {
  contract: typeof xmlSubsetContract
  executed: number
  passed: number
  failed: number
  skipped: number
  reasons: Record<string, number>
}

export function xmlDifferentialSummary(): XmlDifferentialSummary {
  return { contract: xmlSubsetContract, executed: 0, passed: 0, failed: 0, skipped: 0, reasons: {} }
}

function appendText(events: unknown[][], text: string) {
  const previous = events[events.length - 1]
  if (previous?.[0] === 'text') {
    previous[1] = String(previous[1]) + text
  }
  else if (text) {
    events.push(['text', text])
  }
}

/** 属性从事件逐项收集，基线 DOM 字典丢弃属性顺序的行为不参与预言。 */
function baselineShape(Parser: XmlParserConstructor, source: string) {
  const events: unknown[][] = []
  const stack: Array<{ name: string, selfClosing: boolean }> = []
  let attributes: string[][] = []
  let cdata: string | undefined
  const parser = new Parser({
    onopentagname() { attributes = [] },
    onattribute(name, value) { attributes.push([name, value]) },
    onopentag(name) {
      const selfClosing = source[parser.endIndex - 1] === '/'
      events.push(['open', name, selfClosing, attributes])
      stack.push({ name, selfClosing })
    },
    onclosetag(name) {
      const opening = stack.pop()
      invariant(opening?.name === name, 'xml-differential', 'baseline tag stack disagrees with frozen common XML input')
      events.push(['close', name, opening.selfClosing])
    },
    ontext(data) {
      if (cdata !== undefined) {
        cdata += data
      }
      else {
        appendText(events, data)
      }
    },
    oncomment(data) { events.push(['comment', data]) },
    oncdatastart() { cdata = '' },
    oncdataend() {
      events.push(['cdata', cdata])
      cdata = undefined
    },
  }, { xmlMode: true, decodeEntities: true, recognizeSelfClosing: true })
  parser.end(source)
  invariant(stack.length === 0, 'xml-differential', 'baseline left common XML tags open')
  return events
}

function candidateShape(api: TemplateApi, source: string, options: ParseOptions) {
  const document = api.parse(source, options)
  invariant(!document.diagnostics.some(diagnostic => diagnostic.severity === 'error'), 'xml-differential', 'candidate rejected a preclassified common XML input')
  const events: unknown[][] = []
  for (const { node, leave } of treeEntries(document)) {
    if (node.kind === 'element') {
      events.push(leave ? ['close', node.name, node.selfClosing] : ['open', node.name, node.selfClosing, node.attributes.map(attribute => [attribute.name, api.decodeAttribute(attribute.value!, document.syntax, true, attribute.quote)])])
    }
    else if (!leave) {
      if (node.kind === 'text') {
        appendText(events, api.decodeAttribute(node.data, 'xml'))
      }
      else if (node.kind === 'comment') {
        events.push(['comment', node.data.slice(4, -3)])
      }
      else if (node.kind === 'cdata') {
        events.push(['cdata', node.data.slice(9, -3)])
      }
      else {
        invariant(false, 'xml-differential', `unexpected ${node.kind} node inside common XML subset`)
      }
    }
  }
  return events
}

/** 固定子集先独立判定，再比较实际解析事件；失败不会触发重新分类。 */
export function assertXmlDifferential(api: TemplateApi, Parser: XmlParserConstructor | undefined, source: string, options: ParseOptions, summary: XmlDifferentialSummary) {
  const subset = classifyXmlSubset(source, options)
  const reason = !subset.eligible ? subset.reason : !Parser ? 'baseline-unavailable' : undefined
  if (reason) {
    summary.skipped++
    summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1
    return { executed: false, reason }
  }
  summary.executed++
  try {
    equal(candidateShape(api, source, options), baselineShape(Parser!, source), 'xml-differential', 'ordered XML attributes, text, entities, comments or tag structure disagree with htmlparser2')
    summary.passed++
    return { executed: true }
  }
  catch (error) {
    summary.failed++
    throw error
  }
}
