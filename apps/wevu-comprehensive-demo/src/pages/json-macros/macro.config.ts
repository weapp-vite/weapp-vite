export const macroDemoNavTitle = 'JSON Macros'

export const macroDemoNavBg = '#0ea5e9'

export function buildTimeSubtitle() {
  const now = new Date()
  return `generated at build time (${now.toISOString()})`
}
