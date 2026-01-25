import process from 'node:process'
import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs-extra'
import path from 'pathe'

const componentsPath = path.resolve(import.meta.dirname, '../components.json')

const client = axios.create({
  headers: {
    'user-agent': 'weapp-vite/components-sync',
    'accept': 'text/html,application/xhtml+xml,application/xml',
  },
  timeout: 30_000,
})

const TYPE_SEGMENT_MAP = new Map([
  ['string', 'string'],
  ['number', 'number'],
  ['boolean', 'boolean'],
  ['任意', 'any'],
  ['color', 'string'],
  ['textstyle', 'Object'],
  ['segmenttext', 'Object'],
  ['object', 'Object'],
  ['array', 'any[]'],
  ['object array', 'ArrayObject'],
])

function normalizeWhitespace(value) {
  return value
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isAscii(value) {
  if (!value) {
    return false
  }
  for (const char of value) {
    if (char.charCodeAt(0) > 0x7F) {
      return false
    }
  }
  return true
}

function resolveLink(baseUrl, href) {
  if (!href) {
    return ''
  }
  try {
    return new URL(href, baseUrl).toString()
  }
  catch {
    return href
  }
}

function renderNodes($, nodes, baseUrl) {
  return nodes.map(node => renderNode($, node, baseUrl)).join('')
}

function renderNode($, node, baseUrl) {
  if (!node) {
    return ''
  }
  if (node.type === 'text') {
    return node.data ?? ''
  }
  if (node.type !== 'tag') {
    return ''
  }
  const name = node.name
  if (name === 'code') {
    return `\`${$(node).text()}\``
  }
  if (name === 'a') {
    const href = resolveLink(baseUrl, $(node).attr('href') ?? '')
    const label = renderNodes($, $(node).contents().toArray(), baseUrl)
    if (!href) {
      return label
    }
    if (!label) {
      return href
    }
    return `[${label}](${href})`
  }
  if (name === 'br') {
    return '\n'
  }
  if (name === 'p') {
    const content = renderNodes($, $(node).contents().toArray(), baseUrl)
    return `${content}\n\n`
  }
  if (name === 'li') {
    return `${renderNodes($, $(node).contents().toArray(), baseUrl)}\n`
  }
  return renderNodes($, $(node).contents().toArray(), baseUrl)
}

function extractRichText($, element, baseUrl) {
  if (!element) {
    return ''
  }
  const nodes = $(element).contents().toArray()
  return normalizeWhitespace(renderNodes($, nodes, baseUrl))
}

function extractSectionElements($, headingText) {
  const headings = $('h2').filter((_, el) => $(el).text().trim().includes(headingText))
  if (!headings.length) {
    return []
  }
  const elements = []
  let next = headings.first().next()
  while (next.length && next[0].tagName !== 'h2') {
    elements.push(next)
    next = next.next()
  }
  return elements
}

function parseDesc($, baseUrl) {
  const elements = extractSectionElements($, '功能描述')
  const desc = []
  for (const element of elements) {
    if (!element || !element.length) {
      continue
    }
    const tag = element[0].tagName
    if (tag === 'p') {
      const text = extractRichText($, element, baseUrl)
      if (text) {
        desc.push(text)
      }
      continue
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = element.find('li').toArray()
      for (const item of items) {
        const text = extractRichText($, item, baseUrl)
        if (text) {
          desc.push(text)
        }
      }
    }
  }
  return desc
}

function parseSince($) {
  const blocks = $('blockquote p').toArray()
  for (const block of blocks) {
    const text = $(block).text().trim()
    const match = text.match(/基础库\\s*([0-9.]+)\\s*开始支持/)
    if (match?.[1]) {
      return match[1]
    }
  }
  return undefined
}

function parseRelateApis($, baseUrl) {
  const relate = []
  $('blockquote').each((_, block) => {
    const text = $(block).text()
    if (!text.includes('相关文档')) {
      return
    }
    $(block)
      .find('a')
      .each((__, link) => {
        const name = normalizeWhitespace($(link).text())
        const href = resolveLink(baseUrl, $(link).attr('href') ?? '')
        if (name && href) {
          relate.push({ name, link: href })
        }
      })
  })
  return relate
}

function parseNotices($, baseUrl) {
  const notices = []
  $('.wedoc-warning-tips').each((_, el) => {
    const text = extractRichText($, el, baseUrl)
    if (text) {
      notices.push(text)
    }
  })
  return notices
}

function parseBugTips($, baseUrl) {
  const elements = extractSectionElements($, 'Bug')
  const tips = []
  const bugs = []
  for (const element of elements) {
    if (!element || !element.length) {
      continue
    }
    if (element[0].tagName !== 'ol' && element[0].tagName !== 'ul') {
      continue
    }
    element.find('li').each((_, li) => {
      const raw = extractRichText($, li, baseUrl)
      if (!raw) {
        return
      }
      const normalized = raw.replace(/^`?(tip|bug)`?\\s*[:：]\\s*/i, '')
      if (/^`?bug`?/i.test(raw)) {
        bugs.push(normalized)
      }
      else {
        tips.push(normalized)
      }
    })
  }
  return { tips, bugs }
}

function parseAuthorize($, baseUrl) {
  const elements = extractSectionElements($, '功能描述')
  for (const element of elements) {
    const codes = element.find('code').toArray()
    for (const code of codes) {
      const value = normalizeWhitespace($(code).text())
      if (!value.startsWith('scope.')) {
        continue
      }
      const link = element
        .find('a')
        .toArray()
        .map(anchor => resolveLink(baseUrl, $(anchor).attr('href') ?? ''))
        .find(href => href.includes('authorize')) ?? ''
      return link ? { name: value, link } : { name: value }
    }
  }
  return undefined
}

function parseDemoImages($, baseUrl) {
  const images = []
  $('#docContent img').each((_, img) => {
    const src = $(img).attr('src')
    if (!src) {
      return
    }
    const full = resolveLink(baseUrl, src)
    if (full && /\/image\/pic\//.test(full)) {
      images.push(full)
    }
  })
  return images
}

const TABLE_HEADER_HINTS = new Set([
  '属性',
  '属性名',
  '类型',
  '默认值',
  '必填',
  '说明',
  '最低版本',
  '合法值',
  '值',
])

function getTableRows($, table) {
  const bodyRows = $(table).children('tbody').children('tr')
  if (bodyRows.length) {
    return bodyRows.toArray()
  }
  return $(table).children('tr').toArray()
}

function getTableHeaderInfo($, table) {
  const headCells = $(table).find('thead th').toArray()
  if (headCells.length) {
    return {
      headers: headCells.map(cell => normalizeWhitespace($(cell).text())),
      headerRow: null,
    }
  }
  const rows = getTableRows($, table)
  for (const row of rows) {
    const cells = $(row).children('th, td').toArray()
    if (!cells.length) {
      continue
    }
    const labels = cells.map(cell => normalizeWhitespace($(cell).text()))
    if (labels.some(label => TABLE_HEADER_HINTS.has(label))) {
      return { headers: labels, headerRow: row }
    }
  }
  return { headers: [], headerRow: null }
}

function stripMarkdownLinks(value) {
  if (!value) {
    return ''
  }
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
}

function parseEnumTable($, table, baseUrl) {
  if (!table?.length) {
    return []
  }
  const { headers: headerLabels, headerRow } = getTableHeaderInfo($, table)
  const indexMap = new Map()
  headerLabels.forEach((label, index) => {
    if (label) {
      indexMap.set(label, index)
    }
  })

  const valueIndex = indexMap.get('合法值') ?? indexMap.get('值') ?? 0
  const descIndex = indexMap.get('说明') ?? 1
  const sinceIndex = indexMap.get('最低版本')
  const enums = []
  for (const row of getTableRows($, table)) {
    if (headerRow && row === headerRow) {
      continue
    }
    const $row = $(row)
    if ($row.hasClass('children-table')) {
      continue
    }
    const cells = $(row).children('td').toArray()
    const value = normalizeWhitespace(extractRichText($, cells[valueIndex], baseUrl))
    if (!value) {
      continue
    }
    const desc = normalizeWhitespace(extractRichText($, cells[descIndex], baseUrl))
    const since = sinceIndex !== undefined
      ? stripMarkdownLinks(normalizeWhitespace(extractRichText($, cells[sinceIndex], baseUrl)))
      : ''
    const entry = { value }
    if (desc) {
      entry.desc = desc
    }
    if (since) {
      entry.since = since
    }
    enums.push(entry)
  }
  return enums
}

function normalizeType(raw) {
  const cleaned = normalizeWhitespace(raw).replace(/`/g, '')
  if (!cleaned) {
    return undefined
  }
  const lowered = cleaned.toLowerCase()
  if (
    lowered === 'eventhandle'
    || lowered === 'eventhandler'
    || lowered === 'function'
    || lowered === 'worklet'
    || lowered === 'callback'
  ) {
    return { name: 'function', returns: { name: 'any' } }
  }

  const normalized = lowered.replace(/\s+\/\s+/g, '/').replace(/\s+/g, ' ')
  const known = TYPE_SEGMENT_MAP.get(normalized)
  if (known) {
    return { name: known }
  }
  const parts = normalized.includes('/') ? normalized.split('/') : [normalized]
  const mapped = parts.map(part => mapTypeSegment(part.trim()))
  return { name: mapped.join(' | ') }
}

function mapTypeSegment(segment) {
  if (!segment) {
    return segment
  }
  const arrayMatch = segment.match(/^array\.?<(.+)>$/i)
  if (arrayMatch?.[1]) {
    const inner = arrayMatch[1].trim().toLowerCase()
    const mappedInner = TYPE_SEGMENT_MAP.get(inner)
    if (mappedInner === 'Object' || inner === 'object') {
      return 'ArrayObject'
    }
    if (inner === 'string' || inner === 'number' || inner === 'boolean' || inner === 'any') {
      return `${inner}[]`
    }
    return 'any[]'
  }
  return TYPE_SEGMENT_MAP.get(segment) ?? segment
}

function parseAttributeTable($, baseUrl) {
  const tables = $('#docContent table').toArray()
  const seen = new Map()
  const ordered = []
  for (const table of tables) {
    const { headers } = getTableHeaderInfo($, table)
    const headerSet = new Set(headers.filter(Boolean))
    if (!headerSet.has('类型')) {
      continue
    }
    if (!headerSet.has('属性') && !headerSet.has('属性名')) {
      continue
    }
    const attrs = parseAttributesFromTable($, table, baseUrl)
    for (const attr of attrs) {
      const existing = seen.get(attr.name)
      if (existing) {
        seen.set(attr.name, { ...existing, ...attr })
        continue
      }
      seen.set(attr.name, attr)
      ordered.push(attr.name)
    }
  }
  if (ordered.length) {
    return ordered.map(name => seen.get(name)).filter(Boolean)
  }
  const fallbackTable = tables.find(table => getTableHeaderInfo($, table).headers.length)
  return fallbackTable ? parseAttributesFromTable($, fallbackTable, baseUrl) : []
}

function parseAttributesFromTable($, table, baseUrl) {
  const { headers, headerRow } = getTableHeaderInfo($, table)
  if (!headers.length) {
    return []
  }
  const headerIndex = new Map()
  headers.forEach((label, index) => {
    if (label) {
      headerIndex.set(label, index)
    }
  })

  const nameIndex = headerIndex.get('属性') ?? headerIndex.get('属性名')
  const typeIndex = headerIndex.get('类型')
  if (nameIndex === undefined || typeIndex === undefined) {
    return []
  }
  const defaultIndex = headerIndex.get('默认值')
  const requiredIndex = headerIndex.get('必填')
  const descIndex = headerIndex.get('说明')
  const sinceIndex = headerIndex.get('最低版本')
  const attrs = []
  let lastAttr = null

  for (const row of getTableRows($, table)) {
    if (headerRow && row === headerRow) {
      continue
    }
    const $row = $(row)
    if ($row.hasClass('children-table')) {
      if (!lastAttr) {
        continue
      }
      const nested = $row.find('table').first()
      const enumValues = parseEnumTable($, nested, baseUrl)
      if (enumValues.length) {
        lastAttr.enum = enumValues
      }
      continue
    }
    const cells = $row.children('td').toArray()
    if (!cells.length) {
      continue
    }
    const name = nameIndex !== undefined
      ? normalizeWhitespace(extractRichText($, cells[nameIndex], baseUrl))
      : ''
    if (!name || !isAscii(name) || !/^[a-z][\w:-]*$/i.test(name)) {
      continue
    }
    const typeText = typeIndex !== undefined
      ? normalizeWhitespace(extractRichText($, cells[typeIndex], baseUrl))
      : ''
    const descText = descIndex !== undefined
      ? normalizeWhitespace(extractRichText($, cells[descIndex], baseUrl))
      : ''
    const defaultValue = defaultIndex !== undefined
      ? normalizeWhitespace(extractRichText($, cells[defaultIndex], baseUrl))
      : ''
    const requiredText = requiredIndex !== undefined
      ? normalizeWhitespace(extractRichText($, cells[requiredIndex], baseUrl))
      : ''
    const sinceText = sinceIndex !== undefined
      ? stripMarkdownLinks(normalizeWhitespace(extractRichText($, cells[sinceIndex], baseUrl)))
      : ''

    const attr = { name }
    const type = normalizeType(typeText)
    if (type) {
      attr.type = type
    }
    if (descText) {
      attr.desc = [descText]
    }
    if (defaultValue) {
      attr.defaultValue = defaultValue
    }
    if (sinceText) {
      attr.since = sinceText
    }
    if (requiredText === '是') {
      attr.required = true
    }
    attrs.push(attr)
    lastAttr = attr
  }

  return attrs
}

function parsePickerSubAttrs($, baseUrl) {
  const sections = []
  $('h2').each((_, heading) => {
    const title = normalizeWhitespace($(heading).text())
    if (!title.includes('mode')) {
      return
    }
    const match = title.match(/mode\\s*=\\s*([a-zA-Z]+)/)
    if (!match?.[1]) {
      return
    }
    const mode = match[1]
    let next = $(heading).next()
    while (next.length && next[0].tagName !== 'h2') {
      if (next[0].tagName === 'div' && next.find('table').length) {
        const table = next.find('table').first()
        const attrs = parseAttributesFromTable($, table, baseUrl)
        if (attrs.length) {
          sections.push({ equal: mode, attrs })
        }
        return
      }
      next = next.next()
    }
  })
  return sections
}

function sanitizeAttrs(attrs) {
  if (!Array.isArray(attrs)) {
    return []
  }
  const sanitized = []
  for (const attr of attrs) {
    if (!attr?.name) {
      continue
    }
    if (!isAscii(attr.name)) {
      continue
    }
    if (!/^[a-z][\w:-]*$/i.test(attr.name)) {
      continue
    }
    if (typeof attr.type === 'string') {
      attr.type = normalizeType(attr.type) ?? attr.type
    }
    else if (attr.type?.name) {
      attr.type = normalizeType(attr.type.name) ?? attr.type
    }
    sanitized.push(attr)
  }
  return sanitized
}

async function fetchHtml(url) {
  const { data } = await client.get(url, { responseType: 'text' })
  return data
}

async function syncComponent(component) {
  if (!component?.docLink) {
    return component
  }
  const html = await fetchHtml(component.docLink)
  const $ = cheerio.load(html)
  const baseUrl = component.docLink

  const desc = parseDesc($, baseUrl)
  const since = parseSince($)
  const relateApis = parseRelateApis($, baseUrl)
  const notices = parseNotices($, baseUrl)
  const { tips, bugs } = parseBugTips($, baseUrl)
  const authorize = parseAuthorize($, baseUrl)
  const demoImages = parseDemoImages($, baseUrl)
  const attrs = parseAttributeTable($, baseUrl)

  const existingAttrs = new Map((component.attrs ?? []).map(attr => [attr.name, attr]))
  const mergedAttrs = attrs
  const sanitizedAttrs = sanitizeAttrs(mergedAttrs)

  if (component.name === 'picker') {
    const subAttrs = parsePickerSubAttrs($, baseUrl)
    if (subAttrs.length) {
      const modeAttr = mergedAttrs.find(attr => attr.name === 'mode') ?? existingAttrs.get('mode')
      if (modeAttr) {
        modeAttr.subAttrs = subAttrs
        if (!mergedAttrs.includes(modeAttr)) {
          mergedAttrs.push(modeAttr)
        }
      }
    }
  }

  const next = { ...component }
  if (desc.length) {
    next.desc = desc
  }
  if (sanitizedAttrs.length) {
    next.attrs = sanitizedAttrs
  }
  else if (Array.isArray(next.attrs) && next.attrs.length) {
    const fallbackAttrs = sanitizeAttrs(next.attrs)
    if (fallbackAttrs.length) {
      next.attrs = fallbackAttrs
    }
  }
  if (since) {
    next.since = since
  }
  if (relateApis.length) {
    next.relateApis = relateApis
  }
  if (notices.length) {
    next.notices = notices
  }
  if (tips.length) {
    next.tips = tips
  }
  if (bugs.length) {
    next.bugs = bugs
  }
  if (authorize) {
    next.authorize = authorize
  }
  if (demoImages.length) {
    next.demoImages = demoImages
  }
  return next
}

async function main() {
  const components = await fs.readJson(componentsPath)
  const updated = []
  for (const component of components) {
    process.stdout.write(`[components-sync] ${component.name}\\n`)
    try {
      updated.push(await syncComponent(component))
    }
    catch (error) {
      console.error(`[components-sync] failed: ${component.name}`)
      console.error(error)
      updated.push(component)
    }
  }
  await fs.writeJSON(componentsPath, updated, { spaces: 2 })
}

main().catch((error) => {
  console.error('[components-sync] failed')
  console.error(error)
  process.exitCode = 1
})
