import type { Document } from '../../../packages/wxml/src/types'
import type { TemplateApi } from '../assertions'
import type { DomNode, ProfileDependencies, ProfileFixture, ProfileRuntime } from './types'
import { domProjection, stable } from '../../benchmarkWxmlParser/operations'
import { assertTemplate, semanticShape } from '../assertions'
import { assertXmlDifferential, xmlDifferentialSummary } from '../assertions/xml'

const rawXml = { xmlMode: true, decodeEntities: false, withStartIndices: true, withEndIndices: true }
const decodedXml = { ...rawXml, decodeEntities: true, recognizeSelfClosing: true }
const serialization = { xmlMode: true, encodeEntities: 'utf8', selfClosingTags: true }

function createEdit({ parse, edit, serialize }: TemplateApi) {
  return (fixture: ProfileFixture) => {
    let attributeChanged = false
    let textChanged = false
    const document = edit(parse(fixture.source, fixture.options), (editor) => {
      if (!attributeChanged && editor.node.kind === 'element') {
        editor.setAttribute('data-template-regression', 'edited')
        attributeChanged = true
      }
      if (!textChanged && editor.node.kind === 'text' && editor.node.data.trim()) {
        editor.replaceText('template regression text')
        textChanged = true
      }
    })
    return serialize(document, { mode: 'canonical' })
  }
}

/** 两侧共享同一词法消费循环，实际入口仅在计时外读取一次。 */
function createScan({ scan, decodeAttribute }: TemplateApi) {
  return (fixture: ProfileFixture): Array<[string, Record<string, string>]> => {
    const tags: Array<[string, Record<string, string>]> = []
    for (const token of scan(fixture.source, fixture.options).tokens) {
      if (token.kind === 'tag' && !token.closing) {
        const attributes: Record<string, string> = Object.create(null)
        for (const attribute of token.attributes) {
          if (!Object.hasOwn(attributes, attribute.name)) {
            attributes[attribute.name] = decodeAttribute(attribute.value ?? '', fixture.profile.syntax, true, attribute.quote)
          }
        }
        tags.push([token.name, attributes])
      }
    }
    return tags
  }
}

function domShape(root: DomNode): string {
  const output: unknown[] = []
  const stack: Array<DomNode | null> = [root]
  while (stack.length) {
    const node = stack.pop()!
    if (!node) {
      output.push(['end'])
      continue
    }
    if (node.attribs) {
      output.push(['element', node.name, Object.entries(node.attribs)])
      stack.push(null)
    }
    else if (node.type === 'cdata') {
      output.push(['cdata', node.children?.map(child => child.data ?? '').join('')])
      continue
    }
    else if (node.type !== 'root') {
      output.push([node.type, node.data])
      continue
    }
    for (let index = (node.children?.length ?? 0) - 1; index >= 0; index--) {
      stack.push(node.children![index]!)
    }
  }
  return JSON.stringify(output)
}

/** 完整解析、词法元数据与完整 canonical 遍历分别计时；预建树不计入序列化。 */
export function createProfileRuntime({ api, baselineApi, consumers, html, render }: ProfileDependencies, fixtures: ProfileFixture[]): ProfileRuntime {
  const candidateTrees: ProfileRuntime['candidateTrees'] = new Map()
  const baselineTrees = new Map<string, Document | DomNode>()
  const { Parser } = html
  const candidateScan = createScan(api)
  const baselineScan = baselineApi
    ? createScan(baselineApi)
    : (fixture: ProfileFixture): Array<[string, Record<string, string>]> => {
        const tags: Array<[string, Record<string, string>]> = []
        new Parser({ onopentag: (name, attributes) => tags.push([name, attributes]) }, decodedXml).end(fixture.source)
        return tags
      }
  const select: ProfileRuntime['select'] = (operation, arm) => {
    if (operation.startsWith('consumer-')) {
      const consumer = consumers?.[operation]
      if (!consumer) {
        throw new Error(`Missing paired production entry for ${operation}`)
      }
      return consumer[arm]
    }
    if (operation === 'scan') {
      return arm === 'candidate' ? candidateScan : baselineScan
    }
    const selected = arm === 'candidate' ? api : baselineApi
    if (operation === 'parse') {
      if (selected) {
        const { parse } = selected
        return fixture => parse(fixture.source, fixture.options)
      }
      const { parseDocument } = html
      return fixture => parseDocument(fixture.source, rawXml)
    }
    if (operation === 'parse-edit-serialize') {
      if (selected) {
        return createEdit(selected)
      }
      throw new Error('parse-edit-serialize requires a paired TemplateApi baseline')
    }
    if (selected) {
      const { serialize } = selected
      const trees = arm === 'candidate' ? candidateTrees : baselineTrees
      const mode = operation === 'preserve-noop' ? 'preserve' : 'canonical'
      return fixture => serialize(trees.get(fixture.id) as Document, { mode })
    }
    return fixture => render(baselineTrees.get(fixture.id) as DomNode, serialization)
  }
  const run: ProfileRuntime['run'] = (fixture, operation, arm) => select(operation, arm)(fixture)
  return {
    candidateTrees,
    select,
    run,
    verifyOperation(fixture, operation) {
      if (!baselineApi) {
        return
      }
      const projection = (arm: 'baseline' | 'candidate') => {
        const result = run(fixture, operation, arm)
        if (operation === 'consumer-simulator') {
          return domProjection(result as DomNode)
        }
        if (operation === 'parse') {
          const document = result as Document
          return { tokens: document.tokens, diagnostics: document.diagnostics, children: document.children }
        }
        return result
      }
      if (stable(projection('baseline')) !== stable(projection('candidate'))) {
        throw new Error(`Frozen main and candidate ${operation} outputs differ`)
      }
    },
    prepare() {
      const errors: Array<{ fixture: string, error: string }> = []
      for (const fixture of fixtures) {
        try {
          assertTemplate(api, fixture.source, fixture.options)
          candidateTrees.set(fixture.id, api.parse(fixture.source, fixture.options))
          if (baselineApi) {
            assertTemplate(baselineApi, fixture.source, fixture.options)
            const baselineTree = baselineApi.parse(fixture.source, fixture.options)
            baselineTrees.set(fixture.id, baselineTree)
            if (stable(baselineApi.scan(fixture.source, fixture.options)) !== stable(api.scan(fixture.source, fixture.options))) {
              throw new Error('Baseline and candidate complete scan metadata differ')
            }
            if (JSON.stringify(candidateScan(fixture)) !== JSON.stringify(baselineScan(fixture))) {
              throw new Error('Opening tag and decoded attribute scan parity failed')
            }
            const baseline = semanticShape(baselineApi, baselineTree)
            const candidate = semanticShape(api, candidateTrees.get(fixture.id)!)
            if (JSON.stringify(baseline) !== JSON.stringify(candidate)) {
              throw new Error('Baseline and candidate semantic trees differ')
            }
          }
          else if (fixture.comparison.eligible) {
            assertXmlDifferential(api, html.Parser as unknown as Parameters<typeof assertXmlDifferential>[1], fixture.source, fixture.options, xmlDifferentialSummary())
            baselineTrees.set(fixture.id, html.parseDocument(fixture.source, decodedXml))
            if (JSON.stringify(candidateScan(fixture)) !== JSON.stringify(baselineScan(fixture))) {
              throw new Error('Opening tag and decoded attribute scan parity failed')
            }
            const baseline = domShape(html.parseDocument(String(run(fixture, 'canonical', 'baseline')), decodedXml))
            const candidate = domShape(html.parseDocument(String(run(fixture, 'canonical', 'candidate')), decodedXml))
            if (baseline !== candidate) {
              throw new Error('Full canonical serialization changed shared XML semantics')
            }
          }
        }
        catch (error) {
          errors.push({ fixture: fixture.id, error: String(error) })
        }
      }
      return errors
    },
  }
}
