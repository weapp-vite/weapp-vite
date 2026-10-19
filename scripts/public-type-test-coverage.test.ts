import * as filesystem from 'node:fs/promises'
import { glob, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { workspaceTypeTestPackages } from './turboCacheContract/fixture'
import { readWorkflowFixture } from './workflowFixture.mjs'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, readdir: vi.fn(actual.readdir) }
})

const root = path.resolve(import.meta.dirname, '..')
const standardContracts = 'tsd --files "test-d/**/*.test-d.ts"'
const jsxContracts = 'tsd --files "test-d/**/*.test-d.{ts,tsx}"'
const weappViteFixtures = [
  'auto-import-presets',
  'auto-routes-define-app-json',
  'config-define-config',
  'config-public-types',
  'upload-config',
  'i18n-public-types',
  'internal-src-types',
  'resolvers-public-types',
  'runtime-public-types',
  'test-artifact-public-types',
  'dashboard-public-types',
  'vite-public-types',
  'doctor-public-types',
]
const weappViteContracts = weappViteFixtures.map((fixture, index) =>
  `cd ${index === 0 ? 'test-d/' : '../'}${fixture} && tsd --files "**/*.test-d.ts"`,
).join(' && ')
const packages: readonly (readonly [directory: string, build: string, check: string, prebuild?: boolean])[] = [
  ['@weapp-core/api', '', 'tsd', true],
  ['@weapp-core/logger', '', 'tsd --typings dist/index.d.ts --files test/index.test-d.ts'],
  ['@weapp-core/shared', '', standardContracts],
  ['@weapp-core/types', 'build', 'tsd --typings dist/index.d.mts --files "test-d/**/*.test-d.ts"'],
  ['packages/acceptance', '', standardContracts],
  ['packages/agent-core', '', standardContracts],
  ['packages/ast', 'build', standardContracts],
  ['packages/create-weapp-vite', '', 'tsd', true],
  ['packages/devtools-runtime', 'build', standardContracts],
  ['packages/eslint', '', 'cd test-d/compatibility-eslint-public-types && tsd'],
  ['packages/hmr', '', standardContracts],
  ['packages/mcp', '', 'tsd', true],
  ['packages/miniprogram-automator', 'build', standardContracts],
  ['packages/qr', '', standardContracts],
  ['packages/tailwindcss', '', standardContracts],
  ['packages/weapp-ide-cli', 'build', standardContracts],
  ['packages/weapp-vite', '', weappViteContracts],
  ['packages-runtime/glass-easel-web-adapter', 'build', 'tsd --typings dist/index.d.mts --files test-d/public-api.test-d.ts'],
  ['packages-runtime/i18n', 'build', standardContracts],
  ['packages-runtime/json-render', 'build', jsxContracts],
  ['packages-runtime/json-render-components', 'build', standardContracts],
  ['packages-runtime/react', '', standardContracts],
  ['packages-runtime/weapi', '', 'tsd', true],
  ['packages-runtime/web', 'build', standardContracts],
  ['packages-runtime/web-apis', '', standardContracts, true],
  ['packages-runtime/wevu', 'build:types', `${jsxContracts} && tsd --files "test-d/router-named-map.test-types.ts"`],
  ['packages-runtime/wevu-compiler', 'build', standardContracts],
  ['packages-runtime/wevu-query', 'build', jsxContracts],
  ['packages-runtime/wevu-test-utils', 'build', standardContracts],
  ['mpcore/packages/simulator', 'build', standardContracts],
  ['mpcore/packages/test', 'build', standardContracts],
  ['mpcore/packages/vitest', 'build', standardContracts],
  ['mpcore/packages/weapp-vite', 'build', standardContracts],
]

interface Manifest {
  types?: string
  scripts: Record<string, string>
  tsd?: { directory?: string }
}

interface Workflow {
  jobs: Record<string, {
    if?: string
    strategy?: { matrix?: { include?: { main_command?: string, run_types?: boolean }[] } }
    with?: { main_command?: string, run_types?: string }
    steps?: { name?: string, shell?: string, run?: string }[]
  }>
}

async function readManifest(directory: string): Promise<Manifest> {
  return JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as Manifest
}

async function filesUnder(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory, { recursive: true })).map(file => file.replaceAll('\\', '/'))
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function matchingFiles(directory: string, patterns: string[]): Promise<string[]> {
  const files: string[] = []
  // Node 最低支持版本已包含 glob；由固定前缀限定遍历，不扫描包内的依赖和构建产物。
  for await (const file of glob(patterns, { cwd: directory })) {
    files.push(file.replaceAll('\\', '/'))
  }
  return files
}

async function collectContracts(packageRoot: string, script: string): Promise<string[]> {
  let directory = packageRoot
  const selected = new Set<string>()
  for (const command of script.split(/\s*&&\s*/)) {
    if (command.startsWith('cd ')) {
      directory = path.resolve(directory, command.slice(3))
      expect(path.relative(packageRoot, directory).startsWith('..')).toBe(false)
      continue
    }
    const tokens = command.match(/"[^"]*"|\S+/g)?.map(token => token.replace(/^"|"$/g, '')) ?? []
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
  return [...selected].sort()
}

describe('public type tests in CI', () => {
  it.each(['tsd --files "test-d/**/*.test-d.{ts,tsx}"', 'tsd'])('selects all contracts without recursively reading unrelated package trees: %s', async (script) => {
    const packageRoot = await mkdtemp(path.join(tmpdir(), 'type-contract-scope-'))
    const enumerate = vi.spyOn(filesystem, 'readdir')
    try {
      await mkdir(path.join(packageRoot, 'test-d/nested'), { recursive: true })
      await mkdir(path.join(packageRoot, 'node_modules/dependency'), { recursive: true })
      await writeFile(path.join(packageRoot, 'package.json'), '{"types":"dist/index.d.ts","scripts":{}}')
      await writeFile(path.join(packageRoot, 'test-d/nested/public.test-d.ts'), '')
      await writeFile(path.join(packageRoot, 'test-d/nested/jsx.test-d.tsx'), '')
      await writeFile(path.join(packageRoot, 'node_modules/dependency/internal.test-d.ts'), '')
      expect(await collectContracts(packageRoot, script)).toEqual([
        'test-d/nested/jsx.test-d.tsx',
        'test-d/nested/public.test-d.ts',
      ])
      expect(enumerate.mock.calls.some(([directory, options]) => directory === packageRoot
        && typeof options === 'object' && options?.recursive)).toBe(false)
    }
    finally {
      enumerate.mockRestore()
      await rm(packageRoot, { recursive: true, force: true })
    }
  })

  it('covers every workspace package with a public type-test entry', async () => {
    const actual = (await workspaceTypeTestPackages()).map(manifest => manifest.directory)
    expect(actual.sort()).toEqual([...packages.map(([directory]) => directory), 'e2e-apps/lib-mode'].sort())
  })

  it.each(packages.map(([directory, build, check, prebuild]) => ({ directory, build, check, prebuild })))('$directory preserves standalone freshness and checks every real contract', async ({ directory, build, check, prebuild }) => {
    const packageRoot = path.join(root, directory)
    const manifest = await readManifest(packageRoot)
    expect(manifest.scripts['test:types']).toBe(`${build ? `pnpm ${build} && ` : ''}pnpm run test:types:check`)
    expect(manifest.scripts['pretest:types']).toBe(prebuild ? 'pnpm build' : undefined)
    expect(manifest.scripts['test:types:check']).toBe(check)
    expect(manifest.scripts['pretest:types:check']).toBeUndefined()
    expect(manifest.scripts['posttest:types:check']).toBeUndefined()
    const contractRoot = directory === '@weapp-core/logger' ? 'test' : 'test-d'
    const contracts = (await filesUnder(path.join(packageRoot, contractRoot)))
      .filter(file => /\.(?:test-d|test-types)\.tsx?$/.test(file))
      .map(file => `${contractRoot}/${file}`)
      .sort()
    expect(contracts.length).toBeGreaterThan(0)
    expect(await collectContracts(packageRoot, check)).toEqual(contracts)
  })

  it('keeps wevu ordinary build separate from the standalone declaration build', async () => {
    const manifest = await readManifest(path.join(root, 'packages-runtime/wevu'))
    expect(manifest.scripts.build).toBe('tsdown')
    expect(manifest.scripts['build:types']).toBe('tsdown --dts')
    expect(manifest.scripts['test:types:check']).toBe(`${jsxContracts} && tsd --files "test-d/router-named-map.test-types.ts"`)
  })

  it('preserves the lib-mode fixture preparation and selects all its original contracts', async () => {
    const packageRoot = path.join(root, 'e2e-apps/lib-mode')
    const manifest = await readManifest(packageRoot)
    const prepare = 'node ./scripts/prepare-type-fixtures.mjs'
    expect(manifest.scripts['pretest:types']).toBe(prepare)
    expect(manifest.scripts['test:types']).toBe('tsd')
    expect(manifest.scripts['test:types:check']).toBe(`${prepare} && tsd`)
    expect(manifest.scripts['pretest:types:check']).toBeUndefined()
    expect(manifest.scripts['posttest:types:check']).toBeUndefined()
    const contracts = (await filesUnder(path.join(packageRoot, 'test-d')))
      .filter(file => /\.(?:test-d|test-types)\.tsx?$/.test(file))
      .map(file => `test-d/${file}`)
      .sort()
    expect(contracts).toEqual([
      'test-d/dist-lib-file.test-d.ts',
      'test-d/dist-lib.test-d.ts',
      'test-d/dist-matrix.test-d.ts',
    ])
    expect(await collectContracts(packageRoot, manifest.scripts['test:types']!)).toEqual(contracts)
  })

  it('reaches package contracts through the PR type-check job and root task', async () => {
    const manifest = await readManifest(root)
    expect(manifest.scripts['test:types']).toBe('turbo run test:types:check --filter=./packages/* --filter=./packages-runtime/* --filter=./mpcore/packages/* --filter=./@weapp-core/* --filter=weapp-vite-lib-mode-e2e --filter=!@weapp-vite/dashboard')
    const workflow = readWorkflowFixture('ci.yml') as Workflow
    const job = workflow.jobs['build-pr']
    expect(job?.if).toContain('needs.pr-context.outputs.is_pr == \'true\'')
    expect(job?.strategy?.matrix?.include?.filter(entry => entry.run_types)).toHaveLength(1)
    // eslint-disable-next-line no-template-curly-in-string -- 校验 GitHub Actions 表达式原文。
    expect(job?.with?.run_types).toBe('${{ matrix.run_types }}')
    const platform = readWorkflowFixture('reusable-quality-platform.yml') as Workflow
    expect(platform.jobs.types?.if).toBe('inputs.run_types')
    expect(platform.jobs.types?.with?.main_command).toBe('node scripts/ciTypes.mjs')
    const reusable = parse(await readFile(path.join(root, '.github/workflows/reusable-node-command.yml'), 'utf8')) as Workflow
    const steps = Object.values(reusable.jobs).flatMap(entry => entry.steps ?? [])
    const runCommand = steps.find(step => step.name === 'Run command')
    expect(runCommand?.shell).toBe('bash')
    const commandLines = (runCommand?.run ?? '').trim().split(/\r?\n/).map(line => line.trim())
    // eslint-disable-next-line no-template-curly-in-string -- 校验 GitHub Actions 表达式原文。
    expect(commandLines.at(-1)).toBe('${{ inputs.main_command }}')
    // eslint-disable-next-line no-template-curly-in-string -- 校验可选限制只在非 Windows 的主命令 shell 中设置。
    expect(commandLines[0]).toBe('if [[ \'${{ inputs.increase_ulimit && runner.os != \'Windows\' }}\' == \'true\' ]]; then')
    expect(commandLines).toContain('ulimit -n 65536 || true')
    expect(commandLines.join('\n')).toMatch(/printf 'Effective file descriptor limit: '\nulimit -n \|\| true/)
    expect(commandLines).toContain('node .github/scripts/ci-timing.mjs start main')
    expect(steps.filter(step => step.run?.includes('ulimit -n'))).toEqual([runCommand])
  })
})
