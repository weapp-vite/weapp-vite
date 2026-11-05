import type { Attribute } from '@weapp-vite/wxml/core'
import type { OutputBundle } from 'rolldown'
import type { MpPlatform } from '../../types'
import { Buffer } from 'node:buffer'
import MagicString from 'magic-string'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { outputTemplateParser } from '../../wxml/template/parser'

const SCOPE_ATTRIBUTE_RE = /^data-v-[\w-]+$/

/** 支付宝和抖音不支持 scoped 属性选择器，使用同等优先级的 class 保留作用域。 */
export function normalizeClassScopedTemplate(source: string, platform: MpPlatform = 'alipay') {
  if (!source.includes('data-v-')) {
    return source
  }
  const scanned = outputTemplateParser(platform, 'xml').scan(source)
  const diagnostic = scanned.diagnostics.find(item => item.severity === 'error')
  if (diagnostic) {
    throw new Error(`[weapp.wxml] ${diagnostic.start}: ${diagnostic.message}`)
  }
  const result = new MagicString(source)
  for (const token of scanned.tokens) {
    if (token.kind !== 'tag' || token.closing) {
      continue
    }
    const scopes: string[] = []
    let classAttribute: Attribute | undefined
    for (const attribute of token.attributes) {
      if (SCOPE_ATTRIBUTE_RE.test(attribute.name) && !attribute.value) {
        scopes.push(attribute.name)
      }
      if (attribute.name === 'class') {
        classAttribute = attribute
      }
    }
    const classes = new Set((classAttribute?.value ?? '').split(/\s+/))
    const missing = scopes.filter(scope => !classes.has(scope))
    if (!missing.length) {
      continue
    }
    // 保留原 data 属性，避免影响业务读取 dataset；仅增加编译器作用域 class。
    if (classAttribute?.quote) {
      result.appendLeft(classAttribute.valueEnd!, ` ${missing.join(' ')}`)
    }
    else if (classAttribute) {
      result.overwrite(classAttribute.start, classAttribute.end, `class="${classAttribute.value ?? ''} ${missing.join(' ')}"`)
    }
    else {
      result.appendLeft(token.nameEnd, ` class="${missing.join(' ')}"`)
    }
  }
  return result.toString()
}

export function normalizeClassScopedStyle(source: string) {
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
export function normalizeClassScopedAssets(bundle: OutputBundle, extensions: { wxml: string, wxss: string }, platform: MpPlatform = 'alipay') {
  for (const output of Object.values(bundle)) {
    if (output.type !== 'asset') {
      continue
    }
    const source = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString('utf8')
    if (output.fileName.endsWith(`.${extensions.wxml}`)) {
      output.source = normalizeClassScopedTemplate(source, platform)
    }
    else if (output.fileName.endsWith(`.${extensions.wxss}`)) {
      output.source = normalizeClassScopedStyle(source)
    }
  }
}
