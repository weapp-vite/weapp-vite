import { glob, readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'vitest'

export interface TypeTestManifest {
  types?: string
  scripts: Record<string, string>
  tsd?: { directory?: string, compilerOptions?: Record<string, unknown> }
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

function contractPath(packageRoot: string, directory: string, target: string): string {
  const resolved = path.resolve(directory, target)
  const relative = path.relative(packageRoot, resolved)
  expect(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Type contracts cannot escape the package').toBe(false)
  return resolved
}

/** 解析仓库使用的 tsd 目录与文件选项，拒绝未建模参数，避免静默漏掉合约。 */
function tsdSelection(packageRoot: string, directory: string, tokens: string[]) {
  let index = 1
  let selectedDirectory = directory
  if (tokens[index] && !tokens[index]!.startsWith('-')) {
    selectedDirectory = contractPath(packageRoot, directory, tokens[index++]!)
  }
  const patterns: string[] = []
  let typings: string | undefined
  while (index < tokens.length) {
    const option = tokens[index++]!
    expect(['--files', '--typings'], 'Unsupported tsd option or additional positional directory').toContain(option)
    const value = tokens[index++]
    expect(typeof value === 'string' && value.length > 0 && !value.startsWith('-'), `Missing value for tsd option: ${option}`).toBe(true)
    contractPath(packageRoot, selectedDirectory, value!)
    if (option === '--files') {
      patterns.push(value!)
    }
    else {
      expect(typings, 'Duplicate tsd typings option').toBeUndefined()
      typings = value!
    }
  }
  return { directory: selectedDirectory, patterns, typings }
}

/** 只展开受限的包脚本图，alias 保留调用目录，不能引入构建或生命周期命令。 */
export async function collectContracts(packageRoot: string, script: string): Promise<string[]> {
  const selected = new Set<string>()
  const active = new Set<string>()
  const visit = async (source: string, initialDirectory: string) => {
    let directory = initialDirectory
    for (const command of source.split(/\s*&&\s*/)) {
      if (command.startsWith('cd ')) {
        directory = contractPath(packageRoot, directory, command.slice(3))
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
      const selection = tsdSelection(packageRoot, directory, tokens)
      const manifest = await readManifest(selection.directory)
      let matches: string[]
      if (selection.patterns.length > 0) {
        matches = []
        for (const pattern of selection.patterns) {
          const selectedFiles = (await matchingFiles(selection.directory, [pattern])).filter(file => path.matchesGlob(file, pattern))
          expect(selectedFiles.length, `${command} must select real contracts for every files option`).toBeGreaterThan(0)
          matches.push(...selectedFiles)
          if (pattern.includes('**')) {
            const futureFile = pattern.startsWith('test-d/') ? 'test-d/nested/future.test-d.ts' : 'nested/future.test-d.ts'
            expect(path.matchesGlob(futureFile, pattern)).toBe(true)
          }
        }
      }
      else {
        const typings = selection.typings ?? manifest.types ?? 'index.d.ts'
        contractPath(packageRoot, selection.directory, typings)
        // 与 tsd 的默认选择规则一致；.d.mts 不会被替换，必须使用显式 --files。
        const candidates = [typings.replace(/\.d\.ts$/, '.test-d.ts'), typings.replace(/\.d\.ts$/, '.test-d.tsx')]
          .map(file => file.replace(/^\.\//, ''))
        matches = (await matchingFiles(selection.directory, candidates)).filter(file => candidates.includes(file))
        if (matches.length === 0) {
          const testDirectory = manifest.tsd?.directory ?? 'test-d'
          contractPath(packageRoot, selection.directory, testDirectory)
          const patterns = [`${testDirectory}/**/*.ts`, `${testDirectory}/**/*.tsx`]
          matches = (await matchingFiles(selection.directory, patterns))
            .filter(file => patterns.some(pattern => path.matchesGlob(file, pattern)))
        }
      }
      expect(matches.length, `${command} must select real contracts`).toBeGreaterThan(0)
      expect(matches.filter(file => /\.d\.[cm]?ts$/.test(file)), 'Declarations must never be treated as test files').toEqual([])
      for (const file of matches) {
        selected.add(path.relative(packageRoot, contractPath(packageRoot, selection.directory, file)).replaceAll('\\', '/'))
      }
    }
  }
  await visit(script, packageRoot)
  return [...selected].sort()
}
