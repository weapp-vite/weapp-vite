import type { CheerioAPI } from 'cheerio'
import type { AnyNode, Element } from 'domhandler'

interface MarkdownRenderContext {
  $: CheerioAPI
  rewriteHref: (href: string) => string
  rewriteImageSrc: (src: string) => string
}

const BLOCK_TAGS = new Set([
  'article',
  'aside',
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])
const ZERO_WIDTH_RE = /\u200B/g
const WHITESPACE_RE = /\s+/g
const MARKDOWN_ESCAPE_RE = /([*_`])/g
const LANGUAGE_CLASS_RE = /language-([\da-z-]+)/i
const MULTI_BREAK_RE = /\n{3,}/g
const TRAILING_SPACE_RE = /[ \t]+\n/g

function normalizeInlineWhitespace(input: string) {
  return input
    .replace(ZERO_WIDTH_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim()
}

function escapeMarkdownText(input: string) {
  return input.replace(MARKDOWN_ESCAPE_RE, '\\$1')
}

let renderInlineNodes: (nodes: AnyNode[], ctx: MarkdownRenderContext) => string
let renderChildren: (element: Element, ctx: MarkdownRenderContext, depth?: number) => string
let renderNode: (node: AnyNode, ctx: MarkdownRenderContext, depth?: number) => string

function renderInline(node: AnyNode, ctx: MarkdownRenderContext): string {
  const { $ } = ctx

  if (node.type === 'text') {
    return escapeMarkdownText(normalizeInlineWhitespace(node.data))
  }

  if (node.type !== 'tag') {
    return ''
  }

  const element = node as Element
  const tagName = element.tagName.toLowerCase()
  const children = element.children ?? []
  const content = renderInlineNodes(children, ctx)

  if (tagName === 'a') {
    const href = $(element).attr('href')
    if (!href) {
      return content
    }
    return `[${content || href}](${ctx.rewriteHref(href)})`
  }

  if (tagName === 'code') {
    const text = normalizeInlineWhitespace($(element).text())
    return text ? `\`${text}\`` : ''
  }

  if (tagName === 'strong' || tagName === 'b') {
    return content ? `**${content}**` : ''
  }

  if (tagName === 'em' || tagName === 'i') {
    return content ? `*${content}*` : ''
  }

  if (tagName === 'br') {
    return '  \n'
  }

  if (tagName === 'img') {
    const src = $(element).attr('src')
    if (!src) {
      return ''
    }
    const alt = normalizeInlineWhitespace($(element).attr('alt') || '')
    return `![${alt}](${ctx.rewriteImageSrc(src)})`
  }

  return content
}

renderInlineNodes = function renderInlineNodesValue(nodes: AnyNode[], ctx: MarkdownRenderContext) {
  return normalizeInlineWhitespace(nodes.map(node => renderInline(node, ctx)).join(' '))
}

function renderList(element: Element, ctx: MarkdownRenderContext, depth: number) {
  const { $ } = ctx
  const ordered = element.tagName.toLowerCase() === 'ol'
  const items = $(element).children('li').toArray()

  return items.map((item, index) => {
    const prefix = ordered ? `${index + 1}. ` : '- '
    const childBlocks = renderNode(item, ctx, depth + 1)
    const lines = childBlocks.split('\n')
    const [firstLine = '', ...restLines] = lines
    const indent = '  '.repeat(depth)
    const continuationIndent = `${indent}  `
    const normalizedRest = restLines.map(line => (line ? `${continuationIndent}${line}` : '')).join('\n')
    return `${indent}${prefix}${firstLine}${normalizedRest ? `\n${normalizedRest}` : ''}`
  }).join('\n')
}

function renderCodeBlock(element: Element, ctx: MarkdownRenderContext) {
  const { $ } = ctx
  const containerClass = $(element).parent().attr('class') || $(element).attr('class') || ''
  const languageMatch = containerClass.match(LANGUAGE_CLASS_RE)
  const language = languageMatch?.[1]?.toLowerCase() || ''
  const codeText = $(element).text().replace(ZERO_WIDTH_RE, '').trimEnd()
  return `\`\`\`${language}\n${codeText}\n\`\`\``
}

function renderTable(element: Element, ctx: MarkdownRenderContext) {
  const { $ } = ctx
  return $.html(element).trim()
}

renderNode = function renderNodeValue(node: AnyNode, ctx: MarkdownRenderContext, depth = 0): string {
  if (node.type === 'text') {
    return normalizeInlineWhitespace(node.data)
  }

  if (node.type !== 'tag') {
    return ''
  }

  const element = node as Element
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
    const level = Number(tagName.slice(1))
    const text = renderInlineNodes(element.children ?? [], ctx)
    return text ? `${'#'.repeat(level)} ${text}` : ''
  }

  if (tagName === 'p') {
    return renderInlineNodes(element.children ?? [], ctx)
  }

  if (tagName === 'ul' || tagName === 'ol') {
    return renderList(element, ctx, depth)
  }

  if (tagName === 'pre') {
    return renderCodeBlock(element, ctx)
  }

  if (tagName === 'blockquote') {
    const content = renderChildren(element, ctx, depth)
    return content
      .split('\n')
      .map(line => (line ? `> ${line}` : '>'))
      .join('\n')
  }

  if (tagName === 'table') {
    return renderTable(element, ctx)
  }

  if (tagName === 'hr') {
    return '---'
  }

  if (tagName === 'li') {
    const blockChildren = (element.children ?? []).filter(child => child.type === 'tag' && BLOCK_TAGS.has((child as Element).tagName.toLowerCase()))
    const inlineChildren = (element.children ?? []).filter(child => child.type !== 'tag' || !BLOCK_TAGS.has((child as Element).tagName.toLowerCase()))
    const sections: string[] = []
    const inlineText = renderInlineNodes(inlineChildren, ctx)

    if (inlineText) {
      sections.push(inlineText)
    }

    for (const child of blockChildren) {
      const rendered = renderNode(child, ctx, depth)
      if (rendered) {
        sections.push(rendered)
      }
    }

    return sections.join('\n')
  }

  if (tagName === 'img') {
    return renderInline(element, ctx)
  }

  return renderChildren(element, ctx, depth)
}

renderChildren = function renderChildrenValue(element: Element, ctx: MarkdownRenderContext, depth = 0) {
  const blocks: string[] = []

  for (const child of element.children ?? []) {
    const rendered = renderNode(child, ctx, depth)
    if (rendered) {
      blocks.push(rendered)
    }
  }

  return blocks.join('\n\n')
}

export function renderMarkdown(root: Element, ctx: MarkdownRenderContext) {
  const markdown = renderChildren(root, ctx)

  return markdown
    .replace(MULTI_BREAK_RE, '\n\n')
    .replace(TRAILING_SPACE_RE, '\n')
    .trim()
}
