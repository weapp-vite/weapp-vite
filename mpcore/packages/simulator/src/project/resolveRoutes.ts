export interface HeadlessRouteRecord {
  kind: 'page'
  route: string
  source: 'pages' | 'subPackages'
  subpackageRoot?: string
}

const LEADING_SLASH_RE = /^\/+/
const TRAILING_SLASH_RE = /\/+$/
const DUPLICATE_SLASH_RE = /\/{2,}/g

function normalizeSegment(value: string) {
  return value.replace(LEADING_SLASH_RE, '').replace(TRAILING_SLASH_RE, '')
}

function pushRoute(
  records: HeadlessRouteRecord[],
  seen: Set<string>,
  record: HeadlessRouteRecord,
) {
  if (!record.route || seen.has(record.route)) {
    return
  }
  seen.add(record.route)
  records.push(record)
}

export function resolveRoutesFromAppConfig(config: Record<string, any>) {
  const records: HeadlessRouteRecord[] = []
  const seen = new Set<string>()

  if (Array.isArray(config.pages)) {
    for (const page of config.pages) {
      if (typeof page !== 'string') {
        continue
      }
      const route = normalizeSegment(page)
      if (!route) {
        continue
      }
      pushRoute(records, seen, {
        kind: 'page',
        route,
        source: 'pages',
      })
    }
  }

  const subPackages = [
    ...(Array.isArray(config.subPackages) ? config.subPackages : []),
    ...(Array.isArray(config.subpackages) ? config.subpackages : []),
  ]

  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object') {
      continue
    }
    const root = typeof subPackage.root === 'string'
      ? normalizeSegment(subPackage.root)
      : ''
    const pages = Array.isArray(subPackage.pages) ? subPackage.pages : []

    for (const page of pages) {
      if (typeof page !== 'string') {
        continue
      }
      const normalizedPage = normalizeSegment(page)
      if (!normalizedPage) {
        continue
      }
      const route = root
        ? `${root}/${normalizedPage}`.replace(DUPLICATE_SLASH_RE, '/')
        : normalizedPage
      pushRoute(records, seen, {
        kind: 'page',
        route,
        source: 'subPackages',
        subpackageRoot: root || undefined,
      })
    }
  }

  return records
}
