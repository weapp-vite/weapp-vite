import type { WorkbenchFileNode } from '../types/workbench'

interface SessionLike {
  getCurrentPages: () => Array<Record<string, any>>
}

export const HOOK_NAMES = new Set([
  'onAddToFavorites',
  'onError',
  'onHide',
  'onLoad',
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onReady',
  'onResize',
  'onRouteDone',
  'onSaveExitState',
  'onShareAppMessage',
  'onShareTimeline',
  'onShow',
  'onTabItemTap',
  'onUnload',
  'setData',
])

export const themeOptions = [
  { icon: 'icon-[mdi--theme-light-dark]', label: 'Auto', value: 'auto' },
  { icon: 'icon-[mdi--white-balance-sunny]', label: 'Light', value: 'light' },
  { icon: 'icon-[mdi--moon-waning-crescent]', label: 'Dark', value: 'dark' },
] as const

export const explorerTabs = [
  { icon: 'icon-[mdi--folder-multiple-outline]', label: '资源管理器', value: 'resources' },
  { icon: 'icon-[mdi--flask-outline]', label: '场景', value: 'scenarios' },
  { icon: 'icon-[mdi--play-box-multiple-outline]', label: '运行区', value: 'runtime' },
] as const

export const debugTabs = [
  { icon: 'icon-[mdi--language-html5]', label: 'Wxml', value: 'wxml' },
  { icon: 'icon-[mdi--console]', label: 'Console', value: 'console' },
  { icon: 'icon-[mdi--database-cog-outline]', label: 'AppData', value: 'appData' },
  { icon: 'icon-[mdi--folder-search-outline]', label: 'Sources', value: 'sources' },
  { icon: 'icon-[mdi--transit-connection-variant]', label: 'Network', value: 'network' },
  { icon: 'icon-[mdi--speedometer]', label: 'Performance', value: 'performance' },
] as const

export const explorerToolbarIcons = [
  'icon-[mdi--file-outline]',
  'icon-[mdi--folder-outline]',
  'icon-[mdi--magnify]',
  'icon-[mdi--source-branch]',
  'icon-[mdi--content-save-outline]',
  'icon-[mdi--apple-keyboard-command]',
]

export const workbenchToolbarIcons = [
  'icon-[mdi--play-outline]',
  'icon-[mdi--cellphone]',
  'icon-[mdi--refresh]',
  'icon-[mdi--qrcode-scan]',
  'icon-[mdi--dots-horizontal]',
]

export function stringify(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export function collectCallableMethods(session: SessionLike | null) {
  const page = session?.getCurrentPages().at(-1)
  if (!page) {
    return []
  }

  return Object.keys(page)
    .filter(key => typeof page[key] === 'function')
    .filter(key => !HOOK_NAMES.has(key))
    .filter(key => !key.startsWith('__'))
    .sort((a, b) => a.localeCompare(b))
}

export function buildTreeNodes(paths: string[], depth = 0, prefix = ''): WorkbenchFileNode[] {
  const directories = new Map<string, string[]>()
  const files: WorkbenchFileNode[] = []

  for (const rawPath of paths) {
    const relativePath = prefix ? rawPath.slice(prefix.length + 1) : rawPath
    if (!relativePath) {
      continue
    }

    const [segment, ...rest] = relativePath.split('/')
    if (!segment) {
      continue
    }

    if (rest.length === 0) {
      files.push({
        depth,
        name: segment,
        path: prefix ? `${prefix}/${segment}` : segment,
        type: 'file',
      })
      continue
    }

    const bucket = directories.get(segment) ?? []
    bucket.push(prefix ? `${prefix}/${segment}/${rest.join('/')}` : `${segment}/${rest.join('/')}`)
    directories.set(segment, bucket)
  }

  const directoryNodes = Array.from(directories.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, children]) => {
      const path = prefix ? `${prefix}/${name}` : name
      return {
        children: buildTreeNodes(children, depth + 1, path),
        depth,
        name,
        path,
        type: 'directory' as const,
      }
    })

  return [
    ...directoryNodes,
    ...files.sort((a, b) => a.name.localeCompare(b.name)),
  ]
}
