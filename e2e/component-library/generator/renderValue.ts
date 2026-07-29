export function renderInteractionValue(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`
  }
  if (Array.isArray(value)) {
    return `[${value.map(renderInteractionValue).join(', ')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, item]) => `${key}: ${renderInteractionValue(item)}`)
    return `{ ${entries.join(', ')} }`
  }
  return String(value)
}
