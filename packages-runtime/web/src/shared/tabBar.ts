export interface WebTabBarItem {
  pagePath: string
  text: string
  iconPath?: string
  selectedIconPath?: string
}

export interface WebTabBarConfig {
  color: string
  selectedColor: string
  backgroundColor: string
  borderStyle: 'black' | 'white'
  position: 'bottom' | 'top'
  custom: boolean
  list: WebTabBarItem[]
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function normalizePagePath(value: unknown) {
  const path = normalizeOptionalString(value)
  return path?.replace(/^\//, '')
}

export function normalizeWebTabBarConfig(value: unknown): WebTabBarConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const source = value as Record<string, unknown>
  const rawList = Array.isArray(source.list) ? source.list : []
  const list = rawList.flatMap<WebTabBarItem>((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      return []
    }
    const item = rawItem as Record<string, unknown>
    const pagePath = normalizePagePath(item.pagePath)
    if (!pagePath) {
      return []
    }
    return [{
      pagePath,
      text: normalizeOptionalString(item.text) ?? '',
      iconPath: normalizeOptionalString(item.iconPath),
      selectedIconPath: normalizeOptionalString(item.selectedIconPath),
    }]
  })
  if (!list.length) {
    return undefined
  }
  return {
    color: normalizeOptionalString(source.color) ?? '#7a7e83',
    selectedColor: normalizeOptionalString(source.selectedColor) ?? '#3cc51f',
    backgroundColor: normalizeOptionalString(source.backgroundColor) ?? '#ffffff',
    borderStyle: source.borderStyle === 'white' ? 'white' : 'black',
    position: source.position === 'top' ? 'top' : 'bottom',
    custom: source.custom === true,
    list,
  }
}
