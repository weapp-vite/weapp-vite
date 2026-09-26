import { readFile } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 使用 npm 的 semver 子集规则核对依赖的 Node 支持范围。
import { subset, validRange } from 'semver'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  dependencies?: Record<string, string>
  engines?: { node?: string }
}

async function readManifest(filePath: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(filePath, 'utf8')) as PackageManifest
}

describe('create-weapp-vite dependency engines', () => {
  it('supports only Node versions covered by every direct runtime dependency', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const manifest = await readManifest(path.join(packageRoot, 'package.json'))
    const nodeRange = manifest.engines?.node
    if (!nodeRange) {
      throw new Error('create-weapp-vite must declare engines.node')
    }
    expect(validRange(nodeRange), 'create-weapp-vite engines.node').not.toBeNull()

    const dependencyNames = Object.keys(manifest.dependencies ?? {})
    expect(dependencyNames).not.toHaveLength(0)
    for (const name of dependencyNames) {
      const dependency = await readManifest(path.join(packageRoot, 'node_modules', name, 'package.json'))
      const dependencyNodeRange = dependency.engines?.node
      if (dependencyNodeRange) {
        expect(validRange(dependencyNodeRange), `${name} engines.node`).not.toBeNull()
        expect(
          subset(nodeRange, dependencyNodeRange),
          `${name} requires Node ${dependencyNodeRange}, but create-weapp-vite supports ${nodeRange}`,
        ).toBe(true)
      }
    }
  })
})
