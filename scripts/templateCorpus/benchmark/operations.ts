import type { DomNode, ProfileDependencies, ProfileFixture, ProfileRuntime } from './types'
import { assertTemplate } from '../assertions'
import { assertXmlDifferential, xmlDifferentialSummary } from '../assertions/xml'

const rawXml = { xmlMode: true, decodeEntities: false, withStartIndices: true, withEndIndices: true }
const decodedXml = { ...rawXml, decodeEntities: true, recognizeSelfClosing: true }
const serialization = { xmlMode: true, encodeEntities: 'utf8', selfClosingTags: true }

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
export function createProfileRuntime({ api, html, render }: ProfileDependencies, fixtures: ProfileFixture[]): ProfileRuntime {
  const candidateTrees: ProfileRuntime['candidateTrees'] = new Map()
  const baselineTrees = new Map<string, DomNode>()
  const scan = (fixture: ProfileFixture, arm: 'baseline' | 'candidate') => {
    const tags: Array<[string, Record<string, string>]> = []
    if (arm === 'baseline') {
      new html.Parser({ onopentag: (name, attributes) => tags.push([name, attributes]) }, decodedXml).end(fixture.source)
    }
    else {
      for (const token of api.scan(fixture.source, fixture.options).tokens) {
        if (token.kind === 'tag' && !token.closing) {
          const attributes: Record<string, string> = Object.create(null)
          for (const attribute of token.attributes) {
            if (!Object.hasOwn(attributes, attribute.name)) {
              attributes[attribute.name] = api.decodeAttribute(attribute.value ?? '', fixture.profile.syntax, true, attribute.quote)
            }
          }
          tags.push([token.name, attributes])
        }
      }
    }
    return tags
  }
  const run: ProfileRuntime['run'] = (fixture, operation, arm) => {
    if (operation === 'scan') {
      return scan(fixture, arm)
    }
    if (operation === 'parse') {
      return arm === 'candidate' ? api.parse(fixture.source, fixture.options) : html.parseDocument(fixture.source, rawXml)
    }
    return arm === 'candidate' ? api.serialize(candidateTrees.get(fixture.id)!, { mode: 'canonical' }) : render(baselineTrees.get(fixture.id)!, serialization)
  }
  return {
    candidateTrees,
    run,
    prepare() {
      const errors: Array<{ fixture: string, error: string }> = []
      for (const fixture of fixtures) {
        try {
          assertTemplate(api, fixture.source, fixture.options)
          candidateTrees.set(fixture.id, api.parse(fixture.source, fixture.options))
          if (fixture.comparison.eligible) {
            assertXmlDifferential(api, html.Parser as unknown as Parameters<typeof assertXmlDifferential>[1], fixture.source, fixture.options, xmlDifferentialSummary())
            baselineTrees.set(fixture.id, html.parseDocument(fixture.source, decodedXml))
            if (JSON.stringify(scan(fixture, 'candidate')) !== JSON.stringify(scan(fixture, 'baseline'))) {
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
