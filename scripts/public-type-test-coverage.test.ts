import * as filesystem from 'node:fs/promises'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { collectContracts, readManifest } from './publicTypeTestCoverage/contracts'
import { workspaceTypeTestPackages } from './turboCacheContract/fixture'
import { frozenJobCondition, frozenWorkflowText, readVerificationTopologyVariant, readWorkflowFixture } from './workflowFixture.mjs'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, readdir: vi.fn(actual.readdir) }
})

const root = path.resolve(import.meta.dirname, '..')
const standardContracts = 'tsd --files "test-d/**/*.test-d.ts"'
const jsxContracts = 'tsd --files "test-d/**/*.test-d.{ts,tsx}"'
const pureContracts = 'cd test-d-pure && tsd --files "**/*.test-d.ts"'
const hostContracts = 'tsd test-d-host --files root.test-d.ts && tsd test-d-host --files internal-runtime.test-d.ts'
const wevuContracts = `${jsxContracts} && tsd --files "test-d/router-named-map.test-types.ts"`
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
const packages: readonly (readonly [directory: string, build: string, check: string, prebuild?: boolean, pure?: boolean, host?: boolean])[] = [
  ['@weapp-core/api', '', 'tsd', true, true],
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
  ['packages-runtime/i18n', 'build', standardContracts, false, true],
  ['packages-runtime/json-render', 'build', jsxContracts],
  ['packages-runtime/json-render-components', 'build', standardContracts],
  ['packages-runtime/react', '', standardContracts],
  ['packages-runtime/weapi', '', 'tsd', true],
  ['packages-runtime/web', 'build', standardContracts],
  ['packages-runtime/web-apis', '', standardContracts, true, true],
  ['packages-runtime/wevu', 'build:types', wevuContracts, false, true, true],
  ['packages-runtime/wevu-compiler', 'build', standardContracts],
  ['packages-runtime/wevu-query', 'build', jsxContracts],
  ['packages-runtime/wevu-test-utils', 'build', standardContracts],
  ['mpcore/packages/simulator', 'build', standardContracts],
  ['mpcore/packages/test', 'build', standardContracts],
  ['mpcore/packages/vitest', 'build', standardContracts],
  ['mpcore/packages/weapp-vite', 'build', standardContracts],
]

interface Workflow {
  jobs: Record<string, {
    if?: string
    strategy?: { matrix?: { include?: { main_command?: string, run_types?: boolean }[] } }
    with?: { main_command?: string, run_types?: string }
    steps?: { name?: string, shell?: string, run?: string }[]
  }>
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

describe('public type tests in CI', () => {
  it.each([
    { script: jsxContracts, isolated: false },
    { script: 'tsd', isolated: false },
    { script: `${jsxContracts} && pnpm run test:types:host && pnpm run test:types:pure && ${jsxContracts}`, isolated: true },
  ])('selects all contracts without recursively reading unrelated package trees: $script', async ({ script, isolated }) => {
    const packageRoot = await mkdtemp(path.join(tmpdir(), 'type-contract-scope-'))
    const enumerate = vi.spyOn(filesystem, 'readdir')
    try {
      await mkdir(path.join(packageRoot, 'test-d/nested'), { recursive: true })
      await mkdir(path.join(packageRoot, 'node_modules/dependency'), { recursive: true })
      await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({
        types: 'dist/index.d.ts',
        scripts: {
          'test:types:host': 'tsd test-d-host --files root.test-d.ts && tsd test-d-host --files internal-runtime.test-d.ts',
          'test:types:pure': 'cd test-d-pure && tsd --files "**/*.test-d.ts"',
        },
      }))
      await writeFile(path.join(packageRoot, 'test-d/nested/public.test-d.ts'), '')
      await writeFile(path.join(packageRoot, 'test-d/nested/jsx.test-d.tsx'), '')
      await writeFile(path.join(packageRoot, 'node_modules/dependency/internal.test-d.ts'), '')
      if (isolated) {
        for (const directory of ['test-d-host', 'test-d-pure']) {
          await mkdir(path.join(packageRoot, directory, 'nested'), { recursive: true })
          await writeFile(path.join(packageRoot, directory, 'package.json'), '{"types":"index.d.ts","scripts":{}}')
        }
        for (const file of ['test-d-host/root.test-d.ts', 'test-d-host/internal-runtime.test-d.ts', 'test-d-pure/nested/pure.test-d.ts']) {
          await writeFile(path.join(packageRoot, file), '')
        }
      }
      expect(await collectContracts(packageRoot, script)).toEqual([
        ...(isolated ? ['test-d-host/internal-runtime.test-d.ts', 'test-d-host/root.test-d.ts', 'test-d-pure/nested/pure.test-d.ts'] : []),
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

  it.each(packages.map(([directory, build, check, prebuild, pure, host]) => ({ directory, build, check, prebuild, pure, host })))('$directory preserves standalone freshness and checks every real contract', async ({ directory, build, check, prebuild, pure, host }) => {
    const packageRoot = path.join(root, directory)
    const manifest = await readManifest(packageRoot)
    expect(manifest.scripts['test:types']).toBe(`${build ? `pnpm ${build} && ` : ''}pnpm run test:types:check`)
    expect(manifest.scripts['pretest:types']).toBe(prebuild ? 'pnpm build' : undefined)
    const expectedCheck = `${check}${host ? ' && pnpm run test:types:host' : ''}${pure ? ' && pnpm run test:types:pure' : ''}`
    expect(manifest.scripts['test:types:check']).toBe(expectedCheck)
    expect(manifest.scripts['test:types:pure']).toBe(pure ? pureContracts : undefined)
    expect(manifest.scripts['test:types:host']).toBe(host ? hostContracts : undefined)
    expect(manifest.scripts['pretest:types:check']).toBeUndefined()
    expect(manifest.scripts['posttest:types:check']).toBeUndefined()
    const expectedRoots = [directory === '@weapp-core/logger' ? 'test' : 'test-d', ...(pure ? ['test-d-pure'] : []), ...(host ? ['test-d-host'] : [])]
    const contractRoots = directory === '@weapp-core/logger'
      ? ['test']
      : (await readdir(packageRoot, { withFileTypes: true }))
          .filter(entry => entry.isDirectory() && /^test-d(?:-|$)/.test(entry.name))
          .map(entry => entry.name)
    expect(contractRoots.sort()).toEqual(expectedRoots.sort())
    const contracts: string[] = []
    for (const contractRoot of contractRoots) {
      const files = (await filesUnder(path.join(packageRoot, contractRoot)))
        .filter(file => /\.(?:test-d|test-types)\.tsx?$/.test(file))
        .map(file => `${contractRoot}/${file}`)
      expect(files.length, `${contractRoot} must contain real contracts`).toBeGreaterThan(0)
      contracts.push(...files)
    }
    expect(contracts.length).toBeGreaterThan(0)
    expect(await collectContracts(packageRoot, manifest.scripts['test:types:check']!)).toEqual(contracts.sort())
  })

  it('keeps wevu ordinary build separate from the standalone declaration build', async () => {
    const manifest = await readManifest(path.join(root, 'packages-runtime/wevu'))
    expect(manifest.scripts.build).toBe('tsdown')
    expect(manifest.scripts['build:types']).toBe('tsdown --dts')
    expect(manifest.scripts['test:types:check']).toBe(`${wevuContracts} && pnpm run test:types:host && pnpm run test:types:pure`)
  })

  it('isolates wevu host entry programs from automatic globals and pure contracts', async () => {
    const packageRoot = path.join(root, 'packages-runtime/wevu')
    const hostRoot = path.join(packageRoot, 'test-d-host')
    const manifest = await readManifest(hostRoot)
    expect(manifest.types).toBe('index.d.ts')
    expect(manifest.tsd?.compilerOptions).toEqual({
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022', 'DOM'],
      types: [],
      strict: true,
      skipLibCheck: false,
      paths: {
        'wevu': ['../dist/index.d.mts'],
        'wevu/internal-runtime': ['../dist/internal-runtime.d.mts'],
      },
    })
    expect(await collectContracts(packageRoot, 'pnpm run test:types:host')).toEqual([
      'test-d-host/internal-runtime.test-d.ts',
      'test-d-host/root.test-d.ts',
    ])
    const pureContracts = (await filesUnder(path.join(packageRoot, 'test-d-pure')))
      .filter(file => /\.(?:test-d|test-types)\.tsx?$/.test(file))
      .map(file => `test-d-pure/${file}`)
      .sort()
    expect(await collectContracts(packageRoot, 'pnpm run test:types:pure')).toEqual(pureContracts)
    const pureManifest = await readManifest(path.join(packageRoot, 'test-d-pure'))
    expect(pureManifest.tsd?.compilerOptions).toMatchObject({
      lib: ['ES2022'],
      types: [],
      strict: true,
      skipLibCheck: false,
      paths: {
        'wevu/config': ['../dist/config.d.mts'],
        'wevu/types': ['../dist/types.d.mts'],
      },
    })
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
    expect(job?.if).toContain(frozenWorkflowText('needs.pr-context.outputs.is_pr == \'true\'', 'ci'))
    if (readVerificationTopologyVariant() === 'baseline') {
      const roles = job?.strategy?.matrix?.include?.filter(entry => entry.main_command?.split('\n').includes('pnpm test:types'))
      expect(roles).toHaveLength(1)
      expect(roles?.[0]?.main_command).toContain('pnpm build:pkgs:ci\npnpm test:types\npnpm test:dependency-contracts')
      // eslint-disable-next-line no-template-curly-in-string -- 校验实际基线矩阵命令入口。
      expect(job?.with?.main_command).toBe('${{ matrix.main_command }}')
    }
    else {
      expect(job?.strategy?.matrix?.include?.filter(entry => entry.run_types)).toHaveLength(1)
      // eslint-disable-next-line no-template-curly-in-string -- 校验 GitHub Actions 表达式原文。
      expect(job?.with?.run_types).toBe('${{ matrix.run_types }}')
    }
    const platform = readWorkflowFixture('reusable-quality-platform.yml') as Workflow
    expect(platform.jobs.types?.if).toBe(frozenJobCondition('inputs.run_types', 'ci', ['build']))
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
