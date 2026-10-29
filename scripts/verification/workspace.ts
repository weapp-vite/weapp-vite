import type { WorkspacePackage } from './types.ts'
import { glob, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'
import { isRootToolingInput } from './rootTooling.ts'

interface PackageManifest {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface TurboTask {
  inputs?: string[]
  dependsOn?: string[]
}

interface TurboConfiguration {
  globalDependencies?: string[]
  tasks?: Record<string, TurboTask>
}

const CROSS_DIRECTORY_OWNERS = [
  { pattern: 'test/fixture-projects/weapp-vite/**', owners: ['weapp-vite'] },
  { pattern: 'test/fixture-projects/wevu-test-utils-consumer/**', owners: ['@wevu/test-utils'] },
  { pattern: 'templates/**', owners: ['create-weapp-vite'] },
  ...['e2e/scripts/**', 'e2e/utils/**'].map(pattern => ({
    pattern,
    owners: ['weapp-vite', 'weapp-ide-cli', '@weapp-vite/devtools-runtime', '@weapp-vite/miniprogram-automator', '@mpcore/simulator'],
  })),
]
const CROSS_DIRECTORY_PREFIX = /^(?:scripts|e2e|e2e-apps|test|skills|integrations|templates)\//

async function readTurbo(root: string, directory: string): Promise<TurboConfiguration> {
  try {
    return JSON.parse(await readFile(path.join(root, directory, 'turbo.json'), 'utf8')) as TurboConfiguration
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
    return {}
  }
}

function normalizeInput(input: string, directory: string): string | undefined {
  // 负向输入也保守纳入，宁可扩大范围，不在这里重新实现 Turbo 的覆盖规则。
  input = input.replace(/^!/, '').replaceAll('\\', '/')
  if (input === '$TURBO_DEFAULT$' || input === '$TURBO_EXTENDS$') {
    return undefined
  }
  const normalized = input.startsWith('$TURBO_ROOT$/')
    ? input.slice('$TURBO_ROOT$/'.length)
    : path.posix.join(directory, input)
  return normalized.includes('$') || normalized.startsWith('../') || path.posix.isAbsolute(normalized) ? '**' : normalized
}

function explicitDependency(value: string): string | undefined {
  return value.includes('#') ? value.split('#')[0] : undefined
}

/** 读取真实 workspace 成员，包含应用、模板与负向模式。 */
export async function readWorkspace(root: string): Promise<WorkspacePackage[]> {
  const workspace = parse(await readFile(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as { packages: string[] }
  const members: Array<{ directory: string, manifest: PackageManifest }> = []
  const seen = new Set<string>()
  for await (const file of glob(workspace.packages.filter(item => !item.startsWith('!')).map(item => `${item}/package.json`), {
    cwd: root,
    exclude: workspace.packages.filter(item => item.startsWith('!')).map(item => `${item.slice(1)}/package.json`),
  })) {
    if (seen.has(file)) {
      continue
    }
    seen.add(file)
    const manifest = JSON.parse(await readFile(path.join(root, file), 'utf8')) as PackageManifest
    if (manifest.name) {
      members.push({ directory: path.dirname(file).replaceAll('\\', '/'), manifest })
    }
  }
  const names = new Set(members.map(item => item.manifest.name!))
  if (names.size !== members.length) {
    throw new Error('workspace 包名重复，无法安全推导影响范围')
  }
  const rootTurbo = await readTurbo(root, '.')
  return Promise.all(members.map(async ({ directory, manifest }) => {
    const config = await readTurbo(root, directory)
    const rootTasks = Object.entries(rootTurbo.tasks ?? {})
      .filter(([name]) => !name.includes('#') || name.startsWith(`${manifest.name}#`))
      .map(([, task]) => task)
    const tasks = [...rootTasks, ...Object.values(config.tasks ?? {})]
    const extraInputs = [
      ...(rootTurbo.globalDependencies ?? []).map(input => normalizeInput(input, '.')),
      ...tasks.flatMap(task => task.inputs ?? []).map(input => normalizeInput(input, directory)),
      ...CROSS_DIRECTORY_OWNERS.filter(item => item.owners.includes(manifest.name!)).map(item => item.pattern),
    ].filter((input): input is string => input !== undefined)
    const dependencies = new Set<string>()
    for (const [name, value] of [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies, manifest.optionalDependencies].flatMap(group => Object.entries(group ?? {}))) {
      if (names.has(name)) {
        dependencies.add(name)
      }
      const local = /^(?:workspace|file|link):(.+)$/.exec(value)?.[1]
      if (!local) {
        continue
      }
      if (local.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(directory, local))
        const member = members.find(item => item.directory === target)
        if (member) {
          dependencies.add(member.manifest.name!)
        }
        else {
          extraInputs.push(normalizeInput(local, directory)!, normalizeInput(`${local}/**`, directory)!)
        }
      }
      else if (value.startsWith('workspace:') && !names.has(name)) {
        const target = local.replace(/@[^@]*$/, '')
        if (names.has(target)) {
          dependencies.add(target)
        }
        else {
          extraInputs.push('**')
        }
      }
    }
    for (const dependency of tasks.flatMap(task => task.dependsOn ?? []).map(explicitDependency).filter((name): name is string => name !== undefined)) {
      if (names.has(dependency)) {
        dependencies.add(dependency)
      }
      else {
        extraInputs.push('**')
      }
    }
    return { name: manifest.name!, directory, scripts: manifest.scripts ?? {}, dependencies: [...dependencies].sort(), extraInputs: [...new Set(extraInputs)].sort() }
  }))
}

export function ownerOf(file: string, packages: WorkspacePackage[]): WorkspacePackage | undefined {
  return packages.filter(item => file.startsWith(`${item.directory}/`))
    .sort((a, b) => b.directory.length - a.directory.length)[0]
}

export interface PackageImpact {
  direct: Set<string>
  affected: Set<string>
  fallback?: { reason: 'unmapped-cross-directory', files: string[] }
}

/** 包依赖与显式跨根输入共同决定影响闭包，并保留无法证明归属时的回退原因。 */
export function analyzePackageImpact(files: string[], packages: WorkspacePackage[], all = false): PackageImpact {
  // 跨目录 fixture 和工具输入不能仅凭其 workspace owner 推断测试 owner；缺映射时回到全范围。
  const unmapped = files.filter(file => CROSS_DIRECTORY_PREFIX.test(file)
    && !isRootToolingInput(file)
    && !packages.some(item => item.extraInputs.some(pattern => path.posix.matchesGlob(file, pattern))))
  const fallback = unmapped.length ? { reason: 'unmapped-cross-directory' as const, files: unmapped } : undefined
  const direct = new Set(files.flatMap((file) => {
    const owner = ownerOf(file, packages)
    return owner ? [owner.name] : []
  }))
  for (const item of packages) {
    if (files.some(file => item.extraInputs.some(pattern => path.posix.matchesGlob(file, pattern)))) {
      direct.add(item.name)
    }
  }
  const affected = new Set(all || fallback ? packages.map(item => item.name) : direct)
  let changed = true
  while (changed) {
    changed = false
    for (const item of packages) {
      if (!affected.has(item.name) && item.dependencies.some(name => affected.has(name))) {
        affected.add(item.name)
        changed = true
      }
    }
  }
  return { direct, affected, fallback }
}
