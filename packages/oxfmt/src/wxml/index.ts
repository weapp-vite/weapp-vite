import type { FormatConfig } from 'vite-plus/fmt'
import type { Tag, Token } from './tokenize'
import { formatOptions } from '../options'
import { tokenize } from './tokenize'

function placeholder(value: string) {
  return `"${'x'.repeat(Math.max(1, value.length - 2))}"`
}

function surrogate(tag: Tag) {
  const attributes = tag.attributes.map(attribute => attribute.value === undefined
    ? attribute.name
    : `${attribute.name}=${placeholder(attribute.value)}`)
  return `<${'x'.repeat(tag.name.length)}${attributes.length ? ` ${attributes.join(' ')}` : ''} />`
}

function restoreTag(original: Tag, formatted: Tag, source: string, fileName: string) {
  const lineStart = source.lastIndexOf('\n', original.offset - 1) + 1
  const indentation = source.slice(lineStart, original.offset)
  if (/^[\t ]+$/.test(indentation)) {
    const indented = tokenize(formatted.raw.replaceAll('\n', `\n${indentation}`), fileName)[0]
    if (indented?.kind !== 'tag') {
      throw new Error(`${fileName}: 标签缩进校验失败`)
    }
    formatted = indented
  }
  if (formatted.name !== 'x'.repeat(original.name.length) || !formatted.selfClosing || formatted.closing || formatted.attributes.length !== original.attributes.length) {
    throw new Error(`${fileName}: Oxfmt 修改了受保护的标签结构`)
  }
  const replacements = [{ start: formatted.nameStart, end: formatted.nameEnd, value: original.name }]
  for (const [index, attribute] of original.attributes.entries()) {
    const output = formatted.attributes[index]
    if (output.name !== attribute.name || output.value !== (attribute.value === undefined ? undefined : placeholder(attribute.value))) {
      throw new Error(`${fileName}: Oxfmt 修改了受保护的属性 ${attribute.name}`)
    }
    if (attribute.value !== undefined) {
      replacements.push({ start: output.start, end: output.end, value: attribute.value })
    }
  }
  let result = formatted.raw
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end)
  }
  if (!original.selfClosing) {
    result = result.replace(/ ?\/>$/, '>')
  }
  return result
}

function identity(token: Token) {
  return token.kind === 'raw'
    ? token
    : {
        kind: token.kind,
        name: token.name,
        closing: token.closing,
        selfClosing: token.selfClosing,
        attributes: token.attributes.map(({ name, value }) => ({ name, value })),
      }
}

/**
 * 只格式化 WXML 标签，逐字保留文本、插值、属性值和 WXS；结构校验失败时拒绝返回修改结果。
 */
export async function formatWxml(source: string, fileName = 'component.wxml', options: FormatConfig = {}): Promise<string> {
  const tokens = tokenize(source, fileName)
  const openingTags = tokens.filter((token): token is Tag => token.kind === 'tag' && !token.closing)
  if (openingTags.length === 0) {
    return source
  }
  const { format } = await import('vite-plus/fmt').catch((cause: unknown) => {
    throw new Error('安全 WXML 格式化需要安装 Vite+ >=1.2.0，并使用其内置 Oxfmt。', { cause })
  })
  const result = await format('weapp-vite-wxml-tags.html', openingTags.map(surrogate).join('\n'), {
    ...formatOptions,
    ...options,
    htmlWhitespaceSensitivity: 'strict',
  })
  if (result.errors.length > 0) {
    throw new Error(`${fileName}: ${result.errors.map(error => error.message).join('\n')}`)
  }
  const formatted = tokenize(result.code, fileName).filter((token): token is Tag => token.kind === 'tag')
  if (formatted.length !== openingTags.length) {
    throw new Error(`${fileName}: Oxfmt 未完整保留标签 token`)
  }
  let index = 0
  const restored = tokens.map((token) => {
    if (token.kind === 'raw') {
      return token.raw
    }
    if (token.closing) {
      return `</${token.name}>`
    }
    return restoreTag(token, formatted[index++], source, fileName)
  }).join('')
  const outputTokens = tokenize(restored, fileName)
  if (JSON.stringify(tokens.map(identity)) !== JSON.stringify(outputTokens.map(identity))) {
    throw new Error(`${fileName}: WXML 文本或表达式 token 校验失败，拒绝修改`)
  }
  return restored
}
