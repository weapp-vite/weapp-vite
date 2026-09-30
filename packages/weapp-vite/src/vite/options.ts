import type { InlineConfig, Plugin } from 'vite'

export async function resolvePlugins(options: InlineConfig['plugins']): Promise<Plugin[]> {
  const result: Plugin[] = []
  for (const option of options ?? []) {
    const resolved = await option
    if (Array.isArray(resolved)) {
      result.push(...await resolvePlugins(resolved))
    }
    else if (resolved) {
      result.push(resolved)
    }
  }
  return result
}
