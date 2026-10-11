import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { workspaceTypeTestPackages } from './turboCacheContract/fixture'

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
    strategy?: { matrix?: { include?: { main_command?: string }[] } }
    with?: { main_command?: string }
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
    const files = await filesUnder(directory)
    const filesIndex = tokens.indexOf('--files')
    let matches: string[]
    if (filesIndex !== -1) {
      const pattern = tokens[filesIndex + 1]!
      matches = files.filter(file => path.matchesGlob(file, pattern))
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
      matches = files.filter(file => candidates.includes(file))
      if (matches.length === 0) {
        const testDirectory = manifest.tsd?.directory ?? 'test-d'
        matches = files.filter(file => path.matchesGlob(file, `${testDirectory}/**/*.{ts,tsx}`))
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
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8')) as Workflow
    const job = workflow.jobs['build-pr']
    expect(job?.if).toContain('github.event_name == \'pull_request\'')
    expect(job?.strategy?.matrix?.include?.some(entry => /(?:^|\n)pnpm test:types(?:\n|$)/.test(entry.main_command ?? ''))).toBe(true)
    // eslint-disable-next-line no-template-curly-in-string -- 校验 GitHub Actions 表达式原文。
    expect(job?.with?.main_command).toBe('${{ matrix.main_command }}')
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
    expect(commandLines.at(-2)).toBe('fi')
    expect(steps.filter(step => step.run?.includes('ulimit -n'))).toEqual([runCommand])
  })
})
