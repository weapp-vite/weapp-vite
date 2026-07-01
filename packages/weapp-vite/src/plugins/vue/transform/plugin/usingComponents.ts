export function parseUsingComponents(config: string | undefined) {
  if (!config) {
    return {}
  }
  try {
    const parsed = JSON.parse(config)
    const usingComponents = parsed?.usingComponents
    return usingComponents && typeof usingComponents === 'object' && !Array.isArray(usingComponents)
      ? usingComponents as Record<string, string>
      : {}
  }
  catch {
    return {}
  }
}
