import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type PackageJson = Record<string, unknown>

export interface NearestPackage {
  file: string
  data: PackageJson
}

interface PackageLookup {
  candidates: string[]
  package?: NearestPackage
}

type PackageReader = (file: string) => Promise<unknown>

async function readPackage(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown
}

function isPackageJson(value: unknown): value is PackageJson {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 缓存只属于当前插件会话，失效后未完成的读取不能重新填充新一代缓存。 */
export function createPackageImportsCache(reader: PackageReader = readPackage) {
  const packages = new Map<string, Promise<PackageJson | undefined>>()
  const lookups = new Map<string, Promise<PackageLookup>>()
  let generation = 0

  function load(file: string) {
    let pending = packages.get(file)
    if (!pending) {
      pending = Promise.resolve().then(() => reader(file)).then(value => isPackageJson(value) ? value : undefined).catch(() => undefined)
      packages.set(file, pending)
    }
    return pending
  }

  async function lookup(directory: string): Promise<PackageLookup> {
    const candidates: string[] = []
    while (true) {
      const file = path.join(directory, 'package.json')
      candidates.push(file)
      const data = await load(file)
      if (data) {
        return { candidates, package: { file, data } }
      }
      const parent = path.dirname(directory)
      if (parent === directory) {
        return { candidates }
      }
      directory = parent
    }
  }

  return {
    clear() {
      generation++
      packages.clear()
      lookups.clear()
    },
    async find(directory: string): Promise<PackageLookup> {
      while (true) {
        const startedIn = generation
        let pending = lookups.get(directory)
        if (!pending) {
          pending = lookup(directory)
          lookups.set(directory, pending)
        }
        const result = await pending
        if (startedIn === generation) {
          return result
        }
      }
    },
  }
}
