export function slugify(id: string, prefix: string) {
  const normalized = id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${prefix}-${normalized || 'index'}`
}
