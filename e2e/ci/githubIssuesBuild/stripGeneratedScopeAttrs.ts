import MagicString from 'magic-string'
import { outputTemplateParser } from '../../../packages/weapp-vite/src/wxml/template/parser'

const SCOPE_CLASS_RE = /(?:^|\s)data-v-[\w-]+$/
const SCOPE_ATTRIBUTE_RE = /^data-v-[\w-]+$/

export function stripGeneratedScopeAttrs(code: string) {
  if (!code.includes('data-v-')) {
    return code
  }

  let scanned = outputTemplateParser('weapp', 'legacy').scan(code)
  if (scanned.diagnostics.some(item => item.severity === 'error')) {
    scanned = outputTemplateParser('weapp', 'xml').scan(code)
  }
  const diagnostic = scanned.diagnostics.find(item => item.severity === 'error')
  if (diagnostic) {
    throw new Error(`[weapp.wxml] ${diagnostic.start}: ${diagnostic.message}`)
  }

  const result = new MagicString(code)
  for (const token of scanned.tokens) {
    if (token.kind !== 'tag' || token.closing) {
      continue
    }
    const classAttribute = [...token.attributes].reverse().find(attribute => attribute.name === 'class')
    if (classAttribute?.valueStart !== undefined && classAttribute.valueEnd !== undefined) {
      let value = code.slice(classAttribute.valueStart, classAttribute.valueEnd)
      while (true) {
        const match = SCOPE_CLASS_RE.exec(value)
        if (!match) {
          break
        }
        value = value.slice(0, match.index).trimEnd()
      }
      if (value) {
        result.overwrite(classAttribute.valueStart, classAttribute.valueEnd, value)
      }
      else {
        const start = classAttribute.start > 0 && /\s/.test(code[classAttribute.start - 1]!)
          ? classAttribute.start - 1
          : classAttribute.start
        result.remove(start, classAttribute.end)
      }
    }

    for (const attribute of token.attributes) {
      if (!SCOPE_ATTRIBUTE_RE.test(attribute.name) || attribute.value !== '') {
        continue
      }
      const start = attribute.start > 0 && /\s/.test(code[attribute.start - 1]!)
        ? attribute.start - 1
        : attribute.start
      result.remove(start, attribute.end)
    }
  }
  return result.toString()
}
