import type { DefaultTheme } from 'vitepress/theme'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const INCLUDE_RE = /<!--\s*@include:\s*(\S+)\s*-->/g
const H2_RE = /^## ([^\r\n]+)$/gm
const API_HEADING_RE = /^### ([^\r\n]+) \{#([^}\r\n]+)\}$/gm

interface ApiPageDefinition {
  link: string
  source: string
  text: string
}

function readMarkdownWithIncludes(sourcePath: string, seen = new Set<string>()): string {
  const normalizedPath = resolve(sourcePath)
  if (seen.has(normalizedPath)) {
    throw new Error(`circular markdown include: ${normalizedPath}`)
  }

  const source = readFileSync(normalizedPath, 'utf8')
  const nextSeen = new Set(seen).add(normalizedPath)
  return source.replace(INCLUDE_RE, (_, includePath: string) => readMarkdownWithIncludes(resolve(dirname(normalizedPath), includePath), nextSeen))
}

function cleanHeadingText(value: string) {
  return value.replace(/`/g, '').trim()
}

function createApiPageSidebarItem(definition: ApiPageDefinition): DefaultTheme.SidebarItem {
  const sourcePath = fileURLToPath(new URL(`../../${definition.source}`, import.meta.url))
  const source = readMarkdownWithIncludes(sourcePath)
  const headings = [...source.matchAll(H2_RE)]
  const sections = headings.flatMap((heading, index) => {
    const start = (heading.index || 0) + heading[0].length
    const end = headings[index + 1]?.index ?? source.length
    const apiItems = [...source.slice(start, end).matchAll(API_HEADING_RE)]
      .filter(match => !match[2].startsWith('example-'))
      .map(match => ({
        text: cleanHeadingText(match[1]),
        link: `${definition.link}#${match[2]}`,
      }))

    if (!apiItems.length) {
      return []
    }

    return [{
      text: cleanHeadingText(heading[1]),
      collapsed: true,
      items: apiItems,
    } satisfies DefaultTheme.SidebarItem]
  })

  return {
    text: definition.text,
    link: definition.link,
    collapsed: true,
    items: sections,
  }
}

function apiPage(text: string, name: string) {
  return createApiPageSidebarItem({
    text,
    link: `/wevu/api/${name}`,
    source: `wevu/api/${name}.md`,
  })
}

export const wevuApiSidebarItems: DefaultTheme.SidebarItem[] = [
  {
    text: 'API 首页',
    collapsed: false,
    items: [{ text: 'API 首页', link: '/wevu/api/' }],
  },
  {
    text: 'Global API',
    collapsed: false,
    items: [
      apiPage('Core API', 'core'),
      apiPage('Options API', 'options-api'),
    ],
  },
  {
    text: 'Composition API',
    collapsed: false,
    items: [
      apiPage('Reactivity API', 'reactivity'),
      apiPage('Lifecycle API', 'lifecycle'),
      apiPage('Setup Context API', 'setup-context'),
    ],
  },
  {
    text: 'Runtime API',
    collapsed: false,
    items: [
      apiPage('Store API', 'store'),
      apiPage('Runtime Bridge API', 'runtime-bridge'),
    ],
  },
  {
    text: 'Type API',
    collapsed: false,
    items: [
      apiPage('Router API', 'router'),
      apiPage('Router 类型', 'router-types'),
      apiPage('Type Reference', 'types'),
    ],
  },
]
