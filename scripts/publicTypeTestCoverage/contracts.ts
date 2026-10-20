import { glob, readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'vitest'

export interface TypeTestManifest {
  types?: string
  scripts: Record<string, string>
  tsd?: { directory?: string }
}

export async function readManifest(directory: string): Promise<TypeTestManifest> {
  return JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as TypeTestManifest
}

async function matchingFiles(directory: string, patterns: string[]): Promise<string[]> {
  const files: string[] = []
  // Node 最低支持版本已包含 glob；由固定前缀限定遍历，不扫描包内的依赖和构建产物。
  for await (const file of glob(patterns, { cwd: directory })) {
    files.push(file.replaceAll('\\', '/'))
  }
  return files
}

/** 只展开受限的包脚本图，alias 保留调用目录，不能引入构建或生命周期命令。 */
export async function collectContracts(packageRoot: string, script: string): Promise<string[]> {
  const selected = new Set<string>()
  const active = new Set<string>()
  const visit = async (source: string, initialDirectory: string) => {
    let directory = initialDirectory
    for (const command of source.split(/\s*&&\s*/)) {
      if (command.startsWith('cd ')) {
        directory = path.resolve(directory, command.slice(3))
        const relative = path.relative(packageRoot, directory)
        expect(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Type contracts cannot escape the package').toBe(false)
        continue
      }
      const tokens = command.match(/"[^"]*"|\S+/g)?.map(token => token.replace(/^"|"$/g, '')) ?? []
      if (tokens[0] === 'pnpm') {
        expect(tokens.slice(0, 2), 'Only pnpm run aliases may select type contracts').toEqual(['pnpm', 'run'])
        expect(tokens, 'Type contract aliases cannot accept additional arguments').toHaveLength(3)
        const name = tokens[2]!
        const manifest = await readManifest(directory)
        const nested = manifest.scripts[name]
        expect(typeof nested === 'string' && nested.trim().length > 0, `Missing type contract alias: ${name}`).toBe(true)
        expect(manifest.scripts[`pre${name}`], 'Type contract aliases cannot run lifecycle hooks').toBeUndefined()
        expect(manifest.scripts[`post${name}`], 'Type contract aliases cannot run lifecycle hooks').toBeUndefined()
        const key = JSON.stringify([directory, name])
        expect(active.has(key), `Cyclic type contract alias: ${name}`).toBe(false)
        active.add(key)
        try {
          await visit(nested!, directory)
        }
        finally {
          active.delete(key)
        }
        continue
      }
      expect(tokens[0], 'The internal type check must only select and run tsd contracts').toBe('tsd')
      const manifest = await readManifest(directory)
      const filesIndex = tokens.indexOf('--files')
      let matches: string[]
      if (filesIndex !== -1) {
        const pattern = tokens[filesIndex + 1]!
        matches = (await matchingFiles(directory, [pattern])).filter(file => path.matchesGlob(file, pattern))
        if (pattern.includes('**')) {
          const futureFile = pattern.startsWith('test-d/') ? 'test-d/nested/future.test-d.ts' : 'nested/future.test-d.ts'
          expect(path.matchesGlob(futureFile, pattern)).toBe(true)
        }
      }
      else {
        const typingsIndex = tokens.indexOf('--typings')
        const typings = typingsIndex === -1 ? manifest.types ?? 'index.d.ts' : tokens[typingsIndex + 1]!
        // 与 tsd 的默认选择规则一致；.d.mts 不会被替换，必须使用显式 --files。
        const candidates = [typings.replace(/\.d\.ts$/, '.test-d.ts'), typings.replace(/\.d\.ts$/, '.test-d.tsx')]
          .map(file => file.replace(/^\.\//, ''))
        matches = (await matchingFiles(directory, candidates)).filter(file => candidates.includes(file))
        if (matches.length === 0) {
          const testDirectory = manifest.tsd?.directory ?? 'test-d'
          const patterns = [`${testDirectory}/**/*.ts`, `${testDirectory}/**/*.tsx`]
          matches = (await matchingFiles(directory, patterns))
            .filter(file => patterns.some(pattern => path.matchesGlob(file, pattern)))
        }
      }
      expect(matches.length, `${command} must select real contracts`).toBeGreaterThan(0)
      expect(matches.filter(file => /\.d\.[cm]?ts$/.test(file)), 'Declarations must never be treated as test files').toEqual([])
      for (const file of matches) {
        selected.add(path.relative(packageRoot, path.join(directory, file)).replaceAll('\\', '/'))
      }
    }
  }
  await visit(script, packageRoot)
  return [...selected].sort()
}
