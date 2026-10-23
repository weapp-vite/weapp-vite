import { readFile } from 'node:fs/promises'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 使用 npm 的 semver 子集规则核对依赖的 Node 支持范围。
import { subset, valid, validRange } from 'semver'
import { describe, expect, it } from 'vitest'
import { TEMPLATE_CATALOG } from '@/generated/catalog'

interface PackageManifest {
  version?: string
  dependencies?: Record<string, string>
  engines?: { node?: string }
}

async function readManifest(filePath: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(filePath, 'utf8')) as PackageManifest
}

describe('create-weapp-vite dependency engines', () => {
  it.each(['@icebreakers/eslint-config', '@icebreakers/stylelint-config'] as const)('pins %s to a verified version compatible with generated projects', async (name) => {
    const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
    const manifest = await readManifest(path.join(repositoryRoot, 'packages/create-weapp-vite/package.json'))
    const nodeRange = manifest.engines?.node
    expect(nodeRange).toBeTruthy()
    const spec = TEMPLATE_CATALOG[name]
    expect(valid(spec), `${name} must not float to an unverified Node engine or partially published dependency set`).toBe(spec)
    const dependency = await readManifest(path.join(repositoryRoot, 'node_modules', name, 'package.json'))
    expect(dependency.version, `${name} installed candidate must match the generated dependency`).toBe(spec)
    expect(validRange(dependency.engines?.node ?? ''), `${name} engines.node`).not.toBeNull()
    expect(
      subset(nodeRange!, dependency.engines?.node ?? '*'),
      `${name} requires Node ${dependency.engines?.node}, but generated projects support ${nodeRange}`,
    ).toBe(true)
  })

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
