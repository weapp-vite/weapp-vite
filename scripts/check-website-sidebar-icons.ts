import type { DefaultTheme } from 'vitepress/theme'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from '../website/.vitepress/config'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sidebarStylePath = path.join(repoRoot, 'website/.vitepress/theme/styles/_sidebar.scss')
const sidebarStyle = fs.readFileSync(sidebarStylePath, 'utf8')
const externalLinkPattern = /^https?:\/\//u

interface SidebarEntry {
  base: string
  link: string
  text: string
}

function collectSidebarEntries(
  items: DefaultTheme.SidebarItem[] | undefined,
  base: string,
  entries: SidebarEntry[],
) {
  for (const item of items ?? []) {
    if (typeof item.link === 'string' && item.link.length > 0) {
      entries.push({
        base,
        link: item.link,
        text: item.text,
      })
    }

    if (Array.isArray(item.items)) {
      collectSidebarEntries(item.items, base, entries)
    }
  }
}

function collectThemeSidebarEntries(sidebar: DefaultTheme.Sidebar | undefined) {
  const entries: SidebarEntry[] = []

  if (Array.isArray(sidebar)) {
    collectSidebarEntries(sidebar, '/', entries)
    return entries
  }

  if (sidebar && typeof sidebar === 'object') {
    for (const [base, items] of Object.entries(sidebar)) {
      collectSidebarEntries(items as DefaultTheme.SidebarItem[], base, entries)
    }
  }

  return entries
}

const failures: string[] = []

if (!sidebarStyle.includes('.VPSidebar a[href] .text::before')) {
  failures.push('website sidebar 缺少覆盖所有链接的基础 icon 规则：.VPSidebar a[href] .text::before')
}

if (!sidebarStyle.includes('.VPSidebar .group > .text::before')) {
  failures.push('website sidebar 缺少分组标题 icon 规则：.VPSidebar .group > .text::before')
}

for (const entry of collectThemeSidebarEntries(config.themeConfig?.sidebar)) {
  if (externalLinkPattern.test(entry.link)) {
    continue
  }

  if (!entry.link.startsWith('/')) {
    failures.push(`sidebar 链接必须使用绝对路径以匹配 icon 守卫：${entry.base} -> ${entry.text} (${entry.link})`)
  }
}

if (failures.length > 0) {
  throw new Error(`website sidebar icon guard failed:\n${failures.map(item => `- ${item}`).join('\n')}`)
}

console.log('website sidebar icon guard ok')
