import { glob, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 缓存契约需要跨平台进程启动、超时取消和错误传播。
import { execa } from 'execa'
import { parse } from 'yaml'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const turboEntry = createRequire(import.meta.url).resolve('turbo/bin/turbo')

export interface PlannedTask {
  taskId: string
  directory: string
  task: string
  command: string
  hash: string
  inputs: Record<string, string>
  dependencies: string[]
  resolvedTaskDefinition: {
    cache: boolean
    outputs: string[]
  }
}

export async function workspaceTypeTestPackages() {
  const workspace = parse(await readFile(path.join(repositoryRoot, 'pnpm-workspace.yaml'), 'utf8')) as { packages: string[] }
  const manifests: string[] = []
  for await (const file of glob(workspace.packages.filter(pattern => !pattern.startsWith('!')).map(pattern => `${pattern}/package.json`), {
    cwd: repositoryRoot,
    exclude: workspace.packages.filter(pattern => pattern.startsWith('!')).map(pattern => `${pattern.slice(1)}/package.json`),
  })) {
    manifests.push(file.replaceAll('\\', '/'))
  }
  const packages = await Promise.all(manifests.map(async (file) => {
    const manifest = JSON.parse(await readFile(path.join(repositoryRoot, file), 'utf8')) as { name: string, scripts?: Record<string, string> }
    return { directory: path.posix.dirname(file), name: manifest.name, scripts: manifest.scripts ?? {} }
  }))
  return packages.filter(manifest => manifest.scripts['test:types'] || manifest.scripts['test:types:check'])
}

export async function planRepositoryTypeChecks() {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  async function planScript(script: string) {
    const [launcher, ...args] = manifest.scripts[script].trim().split(/\s+/)
    if (launcher !== 'turbo') {
      throw new Error(`${script} must delegate directly to Turbo`)
    }
    const result = await execa(process.execPath, [turboEntry, ...args, '--dry=json'], { cwd: repositoryRoot, timeout: 30_000 })
    return (JSON.parse(result.stdout) as { tasks: PlannedTask[] }).tasks
  }
  const expectedChecks = (await workspaceTypeTestPackages()).map(manifest => `${manifest.name}#test:types:check`)
  const [typeTasks, releaseTasks] = await Promise.all([planScript('test:types'), planScript('ci:release')])
  return { expectedChecks, typeTasks, releaseTasks }
}

const buildScript = `import { appendFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
await mkdir('.runs', { recursive: true })
await appendFile('.runs/build', 'run\\n')
await mkdir('dist', { recursive: true })
await writeFile('dist/result.json', JSON.stringify({ source: await readFile('src/index.js', 'utf8'), docs: await readFile('README.md', 'utf8') }))
if (process.cwd().endsWith('agent-cli')) {
  await cp('../../skills/weapp-acceptance', 'skills/weapp-acceptance', { recursive: true })
}
`

const checkScript = `import { appendFile, mkdir, readFile } from 'node:fs/promises'
await readFile('dist/result.json', 'utf8')
await mkdir('.runs', { recursive: true })
await appendFile('.runs/check', 'run\\n')
`

const agentLintScript = `import { appendFile, readFile } from 'node:fs/promises'
const source = await readFile('../../skills/weapp-acceptance/SKILL.md', 'utf8')
const generated = await readFile('skills/weapp-acceptance/SKILL.md', 'utf8')
if (source !== generated) throw new Error('Lint received stale generated skills')
await appendFile('.runs/lint', 'run\\n')
`

export async function createTurboFixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'turbo-cache-contract-')))
  const rootManifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')) as { packageManager: string }
  const environment = {
    ...process.env,
    CI: 'true',
    NODE_ENV: 'test',
    TURBO_TELEMETRY_DISABLED: '1',
    TURBO_TOKEN: undefined,
    TURBO_TEAM: undefined,
    TURBO_CACHE: 'local:rw',
    TURBO_CACHE_DIR: path.join(root, '.turbo/cache'),
    REPOCTL_RELEASE_NODE_VERSION: process.version,
    REPOCTL_RELEASE_PNPM_VERSION: rootManifest.packageManager,
    REPOCTL_RELEASE_PLATFORM: process.platform,
    REPOCTL_RELEASE_ARCH: process.arch,
  }

  async function write(file: string, content: string) {
    const target = path.join(root, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }

  async function read(file: string) {
    return readFile(path.join(root, file), 'utf8')
  }

  async function turbo(task: string, name: string, args: string[] = [], env: Record<string, string> = {}) {
    return execa(process.execPath, [turboEntry, 'run', task, `--filter=${name}`, '--cache=local:rw', ...args], {
      cwd: root,
      env: { ...environment, ...env },
      timeout: 30_000,
    })
  }

  async function plan(task: string, name = '@cache-fixture/library', env: Record<string, string> = {}) {
    const result = await turbo(task, name, ['--dry=json'], env)
    const parsed = JSON.parse(result.stdout) as { tasks: PlannedTask[] }
    const planned = parsed.tasks.find(item => item.taskId === `${name}#${task}`)
    if (!planned) {
      throw new Error(`Missing ${name}#${task} in Turbo plan`)
    }
    return planned
  }

  try {
    await write('package.json', JSON.stringify({ name: 'cache-contract-fixture', private: true, packageManager: rootManifest.packageManager }))
    await write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n  - "@weapp-core/*"\n  - mpcore/packages/*\n')
    await write('pnpm-lock.yaml', 'lockfileVersion: "9.0"\nimporters:\n  .: {}\n')
    await write('.gitignore', '.turbo\n**/dist/\n**/.runs/\npackages/agent-cli/skills/\n')
    await write('.npmrc', 'manage-package-manager-versions=false\n')
    await write('tsconfig.json', '{}\n')
    await write('tsconfig.base.json', '{}\n')
    await write('scripts/vite/vueOxcTsconfigGuard.ts', 'export const guard = "initial"\n')
    await write('e2e-apps/shared/appLifecycle/observer.ts', 'export const observer = "initial"\n')
    await write('e2e/utils/requestClientsRealHostTraceRuntime.ts', 'export const hostTrace = "initial"\n')
    await write('e2e/utils/requestClientsRealWebSocketProbe.ts', 'export const probe = "initial"\n')
    await write('patches/fixture.patch', 'initial patch\n')
    await write('eslint.config.js', 'export default []\n')
    await write('stylelint.config.js', 'export default {}\n')
    await write('packages/eslint/src/runtimeReceiver.ts', 'export const receiver = "initial"\n')
    await write('scripts/weapp-agent/sync-skill.mjs', 'export const skill = "initial"\n')
    await write('skills/weapp-acceptance/SKILL.md', '# Acceptance\n')
    await write('turbo.json', await readFile(path.join(repositoryRoot, 'turbo.json'), 'utf8'))

    for (const [prefix, name] of [
      ['packages/library', '@cache-fixture/library'],
      ['packages/agent-cli', '@weapp-agent/cli'],
      ['packages/dashboard', '@weapp-vite/dashboard'],
      ['packages/create-weapp-vite', 'create-weapp-vite'],
      ['@weapp-core/init', '@weapp-core/init'],
      ['packages/miniprogram-automator', '@weapp-vite/miniprogram-automator'],
      ['mpcore/packages/simulator', '@mpcore/simulator'],
    ]) {
      await write(`${prefix}/package.json`, JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        ...(prefix === 'mpcore/packages/simulator' ? { dependencies: { '@cache-fixture/library': 'workspace:*' } } : {}),
        scripts: {
          'build': 'node build.mjs',
          'lint': prefix === 'packages/agent-cli' ? 'node lint.mjs' : 'node --version',
          'test': 'node --version',
          'typecheck': 'node --version',
          'test:types': 'node --version',
          'test:types:check': 'node check.mjs',
        },
      }))
      await write(`${prefix}/src/index.js`, 'export const value = "initial"\n')
      await write(`${prefix}/README.md`, '# Library\n')
      await write(`${prefix}/build.mjs`, buildScript)
      await write(`${prefix}/check.mjs`, checkScript)
      if (prefix === 'packages/agent-cli') {
        await write(`${prefix}/lint.mjs`, agentLintScript)
      }
      if (prefix !== 'packages/library' && prefix !== 'mpcore/packages/simulator') {
        await write(`${prefix}/turbo.json`, await readFile(path.join(repositoryRoot, prefix, 'turbo.json'), 'utf8'))
      }
    }

    for (const file of ['bin/cli.js', 'docs/guide.md', 'client.d.ts', 'entry.ts', 'vite.shared.ts', 'vitest.config.mts', 'test-d/public.test-d.ts']) {
      await write(`packages/library/${file}`, 'initial\n')
    }
    for (const file of ['packages/weapp-vite/package.json', 'packages-runtime/wevu/package.json', 'packages-runtime/react/package.json']) {
      await write(file, '{}\n')
    }
    await execa('git', ['init', '--quiet'], { cwd: root })
    await execa('git', ['add', '.'], { cwd: root })
  }
  catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }

  return {
    root,
    read,
    write,
    plan,
    run: (task: string, name = '@cache-fixture/library') => turbo(task, name),
    remove: (file: string) => rm(path.join(root, file), { recursive: true, force: true }),
    cleanup: () => rm(root, { recursive: true, force: true }),
  }
}
