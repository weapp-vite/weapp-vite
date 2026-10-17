import type { ArtifactSource, HeadlessProjectDescriptor } from '@mpcore/simulator'
import type { RenderComponentOptions } from '../types'
import path from 'node:path'
import { createMemoryArtifactSource, createOverlayArtifactSource } from '@mpcore/simulator'
import { serializeComponentData } from '../componentHarness/data'

export function normalizeComponentPath(componentPath: string) {
  const relativePath = componentPath.trim().replaceAll('\\', '/').replace(/^\/+/, '')
  const normalized = path.posix.normalize(relativePath.replace(/\.(?:js|json|wxml)$/, ''))
  const hasDrivePrefix = /^[a-z]:/i.test(relativePath) || /^[a-z]:/i.test(normalized)
  if (hasDrivePrefix || !normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new TypeError('Component paths must point inside the mini-program artifact root.')
  }
  return normalized
}

/** 在本次渲染的 artifact 读取边界递归覆盖组件依赖。 */
export function createComponentOverrides(project: HeadlessProjectDescriptor, overrides: RenderComponentOptions['usingComponents'] = {}): ArtifactSource {
  const root = project.miniprogramRootPath
  const replacements: Record<string, string> = {}
  const entries: [string, string][] = []
  for (const [index, [alias, replacement]] of Object.entries(overrides).entries()) {
    if (typeof replacement === 'string') {
      replacements[alias] = `/${normalizeComponentPath(replacement)}`
      continue
    }
    const relativePath = `mpcore-test/stubs/stub-${index}/index`
    const basePath = path.resolve(root, relativePath)
    replacements[alias] = `/${relativePath}`
    entries.push(
      [`${basePath}.json`, '{"component":true}'],
      [`${basePath}.wxml`, replacement.template ?? '<slot />'],
      [`${basePath}.js`, `Component(${serializeComponentData({
        data: replacement.data ?? {},
        properties: Object.fromEntries(Object.entries(replacement.properties ?? {}).map(([key, value]) => [key, { type: null, value }])),
      }, 'Inline component stubs')})`],
    )
  }
  const source = createOverlayArtifactSource(createMemoryArtifactSource(entries), project.artifactSource)
  if (Object.keys(replacements).length === 0) {
    return source
  }
  return {
    has: filePath => source.has(filePath),
    readText(filePath) {
      const original = source.readText(filePath)
      const basePath = filePath.replace(/\.json$/, '')
      if (!filePath.endsWith('.json') || !source.has(`${basePath}.js`) || !source.has(`${basePath}.wxml`)) {
        return original
      }
      const config = JSON.parse(original ?? '{}') as Record<string, unknown>
      return JSON.stringify({ ...config, usingComponents: { ...config.usingComponents as Record<string, unknown>, ...replacements } })
    },
  }
}
