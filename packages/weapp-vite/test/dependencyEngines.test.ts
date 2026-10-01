import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies -- 发布承诺必须是必需依赖支持范围的子集，不能只比较最低主版本。
import { subset, validRange } from 'semver'
import { describe, expect, it } from 'vitest'

interface Manifest {
  name: string
  version: string
  engines?: { node?: string }
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

function readManifest(file: string): Manifest {
  return JSON.parse(readFileSync(file, 'utf8')) as Manifest
}

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const packageDirectories = [
  'packages/weapp-vite',
  'packages/ast',
  'packages-runtime/web',
  'packages-runtime/wevu-compiler',
  'packages-runtime/wevu',
  'packages-runtime/wevu-test-utils',
  'mpcore/packages/weapp-vite',
  'mpcore/packages/simulator',
  'mpcore/packages/test',
  'mpcore/packages/vitest',
]

describe('published Node support', () => {
  for (const directory of packageDirectories) {
    it(`${directory}: covers the installed required dependency closure`, () => {
      const manifestPath = path.join(repositoryRoot, directory, 'package.json')
      const manifest = readManifest(manifestPath)
      const supported = manifest.engines?.node
      expect(supported).toBeDefined()
      expect(validRange(supported!)).not.toBeNull()
      const visited = new Set<string>()
      const pending = [{ file: manifestPath, chain: manifest.name }]
      const failures: string[] = []

      while (pending.length) {
        const { file, chain } = pending.shift()!
        const resolved = realpathSync(file)
        if (visited.has(resolved)) {
          continue
        }
        visited.add(resolved)
        const dependency = readManifest(resolved)
        const required = dependency.engines?.node
        if (required && !subset(supported!, required)) {
          failures.push(`${chain}@${dependency.version} requires ${required}; declared ${supported}`)
        }
        const require = createRequire(resolved)
        for (const name of Object.keys(dependency.dependencies ?? {})) {
          if (name in (dependency.optionalDependencies ?? {})) {
            continue
          }
          const candidate = require.resolve.paths(`${name}/package.json`)
            ?.map(root => path.join(root, name, 'package.json'))
            .find(existsSync)
          expect(candidate, `${chain} -> ${name}: missing required package`).toBeDefined()
          pending.push({ file: candidate!, chain: `${chain} -> ${name}` })
        }
      }

      expect(failures).toEqual([])
    })
  }
})
