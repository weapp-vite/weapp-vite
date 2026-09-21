import type { OutputBundle } from 'rolldown'
import { Buffer } from 'node:buffer'
import { Parser } from 'htmlparser2'
import MagicString from 'magic-string'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const SCOPE_ATTRIBUTE_RE = /^data-v-[\w-]+$/

/** 支付宝不支持 scoped 属性选择器，使用同等优先级的 class 保留作用域。 */
export function normalizeAlipayScopedTemplate(source: string) {
  if (!source.includes('data-v-')) {
    return source
  }
  const result = new MagicString(source)
  let scopes: string[] = []
  let classEnd: number | undefined
  let unquotedClass: { start: number, end: number, value: string } | undefined
  let classes = new Set<string>()
  let tagEnd = 0
  const parser = new Parser({
    onopentagname(name) {
      scopes = []
      classEnd = undefined
      unquotedClass = undefined
      classes = new Set()
      tagEnd = parser.startIndex + 1 + name.length
    },
    onattribute(name, value, quote) {
      if (SCOPE_ATTRIBUTE_RE.test(name) && value === '') {
        scopes.push(name)
      }
      if (name === 'class') {
        classEnd = parser.endIndex - (quote ? 1 : 0)
        classes = new Set(value.split(/\s+/))
        if (!quote) {
          unquotedClass = { start: parser.startIndex, end: parser.endIndex, value }
        }
      }
    },
    onopentag() {
      scopes = scopes.filter(scope => !classes.has(scope))
      if (!scopes.length) {
        return
      }
      // 保留原 data 属性，避免影响业务读取 dataset；仅增加编译器作用域 class。
      if (unquotedClass) {
        result.overwrite(unquotedClass.start, unquotedClass.end, `class="${unquotedClass.value} ${scopes.join(' ')}"`)
      }
      else if (classEnd !== undefined) {
        result.appendLeft(classEnd, ` ${scopes.join(' ')}`)
      }
      else {
        result.appendLeft(tagEnd, ` class="${scopes.join(' ')}"`)
      }
    },
  }, { xmlMode: true, decodeEntities: false })
  parser.end(source)
  return result.toString()
}

export function normalizeAlipayScopedStyle(source: string) {
  if (!source.includes('data-v-')) {
    return source
  }
  const root = postcss.parse(source)
  root.walkRules((rule) => {
    if (!rule.selector.includes('data-v-')) {
      return
    }
    rule.selector = selectorParser((selectors) => {
      selectors.walkAttributes((attribute) => {
        if (SCOPE_ATTRIBUTE_RE.test(attribute.attribute) && !attribute.operator) {
          attribute.replaceWith(selectorParser.className({ value: attribute.attribute }))
        }
      })
    }).processSync(rule.selector)
  })
  return root.toString()
}

/** 在 bundler 写盘前同时归一化模板和样式，也覆盖仅包含样式资源的 HMR。 */
export function normalizeAlipayScopedAssets(bundle: OutputBundle) {
  for (const output of Object.values(bundle)) {
    if (output.type !== 'asset') {
      continue
    }
    const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString('utf8')
    if (output.fileName.endsWith('.axml')) {
      output.source = normalizeAlipayScopedTemplate(source)
    }
    else if (output.fileName.endsWith('.acss')) {
      output.source = normalizeAlipayScopedStyle(source)
    }
  }
}
