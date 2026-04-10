import type { ResolvedPageLayout } from '../types'

function mergeLayoutUsingComponent(config: string | undefined, tagName: string, importPath: string) {
  const parsed = config ? JSON.parse(config) : {}
  const usingComponents = parsed.usingComponents && typeof parsed.usingComponents === 'object' && !Array.isArray(parsed.usingComponents)
    ? parsed.usingComponents
    : {}

  usingComponents[tagName] = importPath
  parsed.usingComponents = usingComponents
  return JSON.stringify(parsed, null, 2)
}

export function mergeLayoutUsingComponents(
  config: string | undefined,
  layouts: ResolvedPageLayout[],
) {
  let next = config
  for (const layout of layouts) {
    next = mergeLayoutUsingComponent(next, layout.tagName, layout.importPath)
  }
  return next
}

export function mergeSingleLayoutUsingComponent(config: string | undefined, layout: ResolvedPageLayout) {
  return mergeLayoutUsingComponent(config, layout.tagName, layout.importPath)
}
