import type { CSSToken } from '@csstools/css-tokenizer'
import type { ResolvedStyleUnitOptions } from './options'
import { tokenize, TokenType } from '@csstools/css-tokenizer'

function resolveViewportUnitBase(unit: string) {
  if (unit === 'vw') {
    return 'var(--weapp-viewport-width)'
  }
  if (unit === 'vh') {
    return 'var(--weapp-viewport-height)'
  }
  if (unit === 'vmin') {
    return 'min(var(--weapp-viewport-width), var(--weapp-viewport-height))'
  }
  return 'max(var(--weapp-viewport-width), var(--weapp-viewport-height))'
}

function nextSignificantToken(tokens: CSSToken[], from: number) {
  let index = from
  while (tokens[index]?.[0] === TokenType.Whitespace || tokens[index]?.[0] === TokenType.Comment) {
    index += 1
  }
  return index
}

function functionArgument(tokens: CSSToken[], from: number) {
  const index = nextSignificantToken(tokens, from + 1)
  const token = tokens[index]
  const following = tokens[nextSignificantToken(tokens, index + 1)]
  if (token?.[0] === TokenType.Ident && (following?.[0] === TokenType.Comma || following?.[0] === TokenType.CloseParen)) {
    return { index, value: token[4].value }
  }
}

/** 仅转换完整单位 token；字面量及运行时视口变量的浏览器 fallback 保持原样。 */
export function transformStyleValue(value: string, options: ResolvedStyleUnitOptions) {
  const tokens = tokenize({ css: value })
  const replacements = new Map<number, string>()
  let protectedDepth = 0
  return tokens.map((token, index) => {
    if (protectedDepth > 0) {
      if (token[0] === TokenType.Function || token[0] === TokenType.OpenParen) {
        protectedDepth += 1
      }
      else if (token[0] === TokenType.CloseParen) {
        protectedDepth -= 1
      }
      return token[1]
    }
    if (token[0] === TokenType.Function) {
      const name = token[4].value.toLowerCase()
      const argument = functionArgument(tokens, index)
      if (name === 'url' || (name === 'var' && (argument?.value === '--weapp-viewport-width' || argument?.value === '--weapp-viewport-height'))) {
        protectedDepth = 1
        return token[1]
      }
      if (name === 'env' && argument && /^safe-area-inset-(?:top|right|bottom|left)$/i.test(argument.value)) {
        replacements.set(argument.index, `--weapp-${argument.value.toLowerCase()}`)
        return 'var('
      }
    }
    const replacement = replacements.get(index)
    if (replacement !== undefined) {
      return replacement
    }
    if (token[0] !== TokenType.Dimension || !Number.isFinite(token[4].value)) {
      return token[1]
    }
    const numeric = token[4].value
    const unit = token[4].unit.toLowerCase()
    if (unit === 'rpx') {
      if (options.useVariable) {
        return `calc(var(${options.rpxVar}) * ${numeric})`
      }
      return `${Math.round(numeric * options.ratio * 1000) / 1000}px`
    }
    if (!options.useVariable || !/^(?:vw|vh|vmin|vmax)$/.test(unit)) {
      return token[1]
    }
    const base = resolveViewportUnitBase(unit)
    return numeric === 0 ? '0px' : numeric === 100 ? base : `calc(${base} * ${numeric} / 100)`
  }).join('')
}
