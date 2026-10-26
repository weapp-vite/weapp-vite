import type { ChangeSet, ResourceBudget, SelectionMode, VerificationMode, VerificationPlan, VerificationTask, WorkspacePackage } from './types.ts'
import { createHash } from 'node:crypto'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { sharedBuildPackages, splitCliBuild, usePreparedTypeChecks } from './build.ts'
import { DEFAULT_SELECTION } from './policy.ts'
import { fullRuntimeBlock } from './runtime.ts'
import { fingerprintConfiguration } from './snapshot.ts'
import { toolchainEnvironment } from './toolchain.ts'
import { ROOT_REPOSITORY_TEST_GLOBS, scriptTestInventory, workflowContractInventory } from './toolTests.ts'
import { resolveVerificationTopology, topologyEnvironment } from './topology.ts'
import { analyzePackageImpact, ownerOf } from './workspace.ts'

const GLOBAL_INPUTS = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', 'tsconfig.json', 'tsconfig.base.json', '.npmrc', 'eslint.config.js', 'stylelint.config.js']
const GLOBAL_PREFIXES = ['patches/', 'scripts/vite/']
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const STYLE_FILE = /\.(?:css|scss|sass|less|wxss|acss|ttss|qss|jxss|vue)$/
const LINT_FILE = /\.(?:[cm]?[jt]sx?|vue|json|jsonc|ya?ml|md)$/

export interface PlanOptions {
  root: string
  changes: ChangeSet
  packages: WorkspacePackage[]
  resources: ResourceBudget
  mode: VerificationMode
  partial?: boolean
  selection?: SelectionMode
  topology?: string
}

function task(id: string, kind: VerificationTask['kind'], args: string[], reason: string, dependencies: string[] = []): VerificationTask {
  return { id, kind, command: 'pnpm', args, directory: '.', dependencies, reason }
}

async function existing(root: string, file: string): Promise<boolean> {
  try {
    await access(path.join(root, file))
    return true
  }
  catch {
    return false
  }
}

async function nearbyTests(root: string, files: string[]): Promise<string[]> {
  const candidates = files.flatMap(file => TEST_FILE.test(file)
    ? [file]
    : /\.[cm]?[jt]sx?$/.test(file)
      ? [file.replace(/\.[^.]+$/, '.test.ts'), file.replace(/\.[^.]+$/, '.spec.ts'), file.replace(/(\.[^.]+)$/, '.test$1'), file.replace(/(\.[^.]+)$/, '.spec$1')]
      : [])
  const found = await Promise.all(candidates.map(async file => await existing(root, file) ? file : undefined))
  return [...new Set(found.filter((file): file is string => file !== undefined))].sort()
}

/** 将变更分成可并行静态检查、共享构建与受管 runtime 阶段。 */
export async function createVerificationPlan(options: PlanOptions): Promise<VerificationPlan> {
  const { root, changes, packages, resources, mode } = options
  const executionTopology = resolveVerificationTopology(options.topology)
  const selection = options.selection ?? DEFAULT_SELECTION
  const global = changes.fallback || mode === 'full' || changes.files.some(file => GLOBAL_INPUTS.includes(file) || GLOBAL_PREFIXES.some(prefix => file.startsWith(prefix)))
  const unknown = changes.files.filter(file => !ownerOf(file, packages)
    && !/^(?:scripts|docs|website|skills|\.changeset|\.github|e2e|test)\//.test(file)
    && !/^(?:AGENTS(?:\.local)?\.md|README.*|LICENSE.*|\.gitignore)$/.test(file)
    && !GLOBAL_INPUTS.includes(file))
  const impact = analyzePackageImpact(changes.files, packages, global || unknown.length > 0)
  const { direct, affected } = impact
  const suggested = mode === 'quick' && !global && !unknown.length && !impact.fallback ? direct : affected
  const selected = packages.filter(item => selection === 'shadow' || suggested.has(item.name))
  const tasks: VerificationTask[] = []
  const warnings = [...changes.warnings]
  const remaining: string[] = []
  if (selection === 'shadow') {
    warnings.push('shadow 阶段仅展示建议范围，实际保留全部 workspace 包；显式 --selection affected 才启用缩选')
  }
  if (unknown.length) {
    warnings.push(`未分类文件触发保守全范围: ${unknown.join(', ')}`)
  }
  if (impact.fallback) {
    warnings.push(`未映射的跨目录输入触发保守全范围: ${impact.fallback.files.join(', ')}`)
  }
  const files = (await Promise.all(changes.files.map(async file => await existing(root, file) ? file : undefined)))
    .filter((file): file is string => file !== undefined)
  const lint = files.filter(file => LINT_FILE.test(file))
  const styles = files.filter(file => STYLE_FILE.test(file))
  if (mode === 'full') {
    tasks.push(task('lint', 'lint', ['exec', 'eslint', '.'], '正式全量静态检查'))
  }
  else if (lint.length) {
    tasks.push(task('lint', 'lint', ['exec', 'eslint', '--no-warn-ignored', ...lint], '只检查实际变更且仍存在的文件'))
  }
  if (styles.length) {
    tasks.push(task('stylelint', 'stylelint', ['exec', 'stylelint', ...styles], '独立样式及 Vue style block'))
  }

  if (mode === 'full') {
    tasks.push({ ...task('build', 'build', ['run', 'build:pkgs', `--concurrency=${resources.buildConcurrency}`], '完整包构建由现有 Turbo 图负责'), exclusive: true })
    tasks.push({ ...task('tests', 'test', ['run', 'test', `--maxWorkers=${resources.jobs}`], '原始完整 workspace 测试集合', ['build']), exclusive: true })
    tasks.push({ ...task('types', 'types', ['run', 'test:types', `--concurrency=${resources.jobs}`], '全部公开类型契约；复用已经构建的 Turbo 缓存', ['build']), exclusive: true })
    tasks.push({ ...task('typecheck', 'typecheck', ['exec', 'turbo', 'run', 'typecheck', '--filter=./packages/*', '--filter=./packages-runtime/*', '--filter=./mpcore/packages/*', '--filter=./@weapp-core/*', `--concurrency=${resources.jobs}`], '完整库源码类型检查', ['build']), exclusive: true })
  }
  else {
    const [sharedScope, consumerScope] = await Promise.all([
      sharedBuildPackages(root, selected.map(item => item.name)),
      sharedBuildPackages(root, selected.filter(item => /^(?:apps|templates)\//.test(item.directory)).map(item => item.name), 'build:apps'),
    ])
    const needed = new Set(selected.map(item => item.name))
    let expanded = true
    while (expanded) {
      expanded = false
      for (const item of packages.filter(item => needed.has(item.name))) {
        for (const dependency of item.dependencies) {
          if (!needed.has(dependency)) {
            needed.add(dependency)
            expanded = true
          }
        }
      }
    }
    const built = packages.filter(item => needed.has(item.name) && item.scripts.build
      && (sharedScope.has(item.name) || (selected.includes(item) && consumerScope.has(item.name) && /^(?:apps|templates)\//.test(item.directory)))
      && (mode === 'review' || item.scripts.typecheck || direct.has(item.name)))
    const delegated = selected.filter(item => item.scripts.build && !built.includes(item) && /^(?:test|e2e-apps)\//.test(item.directory))
    if (delegated.length) {
      warnings.push(`fixture 与正负例产物由原测试/runtime owner 构建，不作为成功 build 目标: ${delegated.map(item => item.name).join(', ')}`)
    }
    if (built.length) {
      tasks.push({
        ...task('build', 'build', ['exec', 'turbo', 'run', 'build', ...built.map(item => `--filter=${item.name}`), `--concurrency=${resources.buildConcurrency}`], '统一准备选中检查所需 dist；Turbo 去重上游构建'),
        exclusive: true,
      })
    }
    const prepared = tasks.some(item => item.id === 'build') ? ['build'] : []
    const pure = selected.filter(item => item.scripts['test:pure'])
    if (pure.length) {
      tasks.push({
        ...task('pure', 'test', ['exec', 'turbo', 'run', 'test:pure', ...pure.map(item => `--filter=${item.name}`), `--concurrency=${resources.jobs}`], '只缓存经过审计的纯测试项目'),
        exclusive: true,
      })
    }
    const ordinary = selected.filter(item => item.scripts.test && !item.scripts['test:pure'])
    for (const item of ordinary) {
      const related = mode === 'quick' ? await nearbyTests(root, files.filter(file => ownerOf(file, packages)?.name === item.name)) : []
      const args = ['--filter', item.name, 'run', 'test']
      if (/\bvitest\b/.test(item.scripts.test!)) {
        args.push(`--maxWorkers=${ordinary.length === 1 ? resources.jobs : 1}`)
        if (related.length) {
          args.push(...related.map(file => path.posix.relative(item.directory, file)))
        }
      }
      tasks.push({
        ...task(`test:${item.name}`, 'test', args, related.length ? '首轮只运行相邻回归；review 仍执行完整包测试' : '无法证明更小范围，保留完整包测试', prepared),
        exclusive: ordinary.length === 1,
        // pnpm 生命周期与测试同属一个命令，可能清理共享 dist，必须与消费者互斥。
        resource: ['pretest', 'posttest'].some(name => item.scripts[name]?.trim()) ? 'workspace-write' : undefined,
      })
    }
    for (const item of selected.filter(item => item.scripts.typecheck && (sharedScope.has(item.name) || direct.has(item.name)))) {
      tasks.push(task(`typecheck:${item.name}`, 'typecheck', ['--filter', item.name, 'run', 'typecheck'], '验证拥有源码的包级类型边界', prepared))
    }
    const types = selected.filter(item => item.scripts['test:types:check'])
    if (mode === 'review' && types.length) {
      tasks.push({
        ...task('types', 'types', ['exec', 'turbo', 'run', 'test:types:check', ...types.map(item => `--filter=${item.name}`), `--concurrency=${resources.jobs}`], '统一类型契约任务图，避免包级包装命令再次直接 build', prepared),
        exclusive: true,
      })
    }
  }
  const cliChanged = changes.files.some(file => file.startsWith('packages/weapp-vite/src/'))
  const scripts = changes.files.filter(file => file.startsWith('scripts/'))
  const workflowChanged = changes.files.some(file => file.startsWith('.github/'))
  if (mode === 'full' || scripts.length || workflowChanged) {
    const inventory = await scriptTestInventory(root)
    const scriptTests = mode === 'quick' ? await nearbyTests(root, scripts) : []
    const selectedTests = new Set(mode === 'full' || (scripts.length && (mode === 'review' || !scriptTests.length)) ? inventory.all : scriptTests)
    if (mode === 'full' || workflowChanged) {
      for (const file of await workflowContractInventory(root, inventory.all)) {
        selectedTests.add(file)
      }
    }
    const scope = [...selectedTests].filter(file => inventory.all.includes(file) && (mode !== 'full' || !inventory.root.has(file))).sort()
    if (scope.length) {
      // 完整集合用目录和排除模式表达，避免 Windows 启动参数超过命令行长度限制。
      const filters = mode === 'full'
        ? ['scripts', ...ROOT_REPOSITORY_TEST_GLOBS.flatMap(pattern => ['--exclude', pattern])]
        : scope.length === inventory.all.length ? ['scripts'] : scope
      tasks.push({ ...task('repo-scripts', 'test', ['exec', 'vitest', 'run', '--config', 'scripts/vitest.config.mjs', ...filters, `--maxWorkers=${resources.jobs}`], mode === 'full' ? '补齐根测试未发现的工具契约；已有 TS 工具测试由根入口执行' : '脚本与工作流契约按文件合并去重；删除输入也保留工具验证', mode === 'full' ? ['tests'] : []), exclusive: true })
    }
  }
  const internal = changes.files.filter(file => /^e2e\/(?:scripts|utils)\//.test(file))
  if (internal.length || mode === 'full') {
    const related = mode === 'quick' ? await nearbyTests(root, internal) : []
    tasks.push({ ...task('runtime:internal-contracts', 'runtime', ['exec', 'vitest', 'run', '-c', 'e2e/vitest.e2e.internal.config.ts', ...related, `--maxWorkers=${resources.jobs}`], 'E2E 工具变更运行受机器租约保护的内部契约；headless gate 不能替代', tasks.map(item => item.id)), exclusive: true })
  }
  if (mode !== 'full' && changes.files.some(file => file.startsWith('e2e/ci/'))) {
    tasks.push({ ...task('runtime:ci', 'runtime', ['run', 'e2e:ci'], 'CI runtime 用例变更必须保留受管 CI suite', tasks.map(item => item.id)), exclusive: true })
  }
  if (mode !== 'full' && changes.files.some(file => file.startsWith('e2e/web-runtime/'))) {
    tasks.push({ ...task('runtime:web', 'runtime', ['run', 'e2e:web'], 'Web runtime 用例变更运行原受管 Web suite', tasks.map(item => item.id)), exclusive: true })
  }
  if (mode === 'quick') {
    remaining.push('quick 仅提供首轮反馈；仍需 review 的消费者、公开类型和 runtime 验证')
  }
  if (options.partial) {
    remaining.push('显式文件筛选属于局部诊断，未覆盖完整变更集')
  }
  const runtimeChanged = selection === 'shadow' || [...affected].some(name => /weapp|wevu|mpcore|react/.test(name)) || changes.files.some(file => file.startsWith('e2e/'))
  if (mode !== 'quick' && (runtimeChanged || mode === 'full')) {
    const dependencies = tasks.map(item => item.id)
    tasks.push({ ...task('runtime:headless', 'runtime', ['run', mode === 'full' ? 'e2e:ide:headless:full' : 'e2e:ide:headless:gate'], '复用原受管 provider-compatible runtime 入口与机器串行租约', dependencies), exclusive: true })
    if (mode === 'full') {
      tasks.push({ ...task('runtime:full', 'runtime', ['exec', 'node', '--import', 'tsx', 'scripts/verification/runtime.ts'], '复用 e2e:full 的 CI、Web 与真实 IDE full 集合', ['runtime:headless']), exclusive: true, blockedReason: await fullRuntimeBlock(root) })
    }
    else {
      remaining.push('headless gate 属于局部证据；真实 IDE 目标场景仍需最终验收')
    }
  }
  else if (runtimeChanged) {
    remaining.push('相关 headless 与真实 IDE runtime 需通过 review 和受管 E2E 入口验收')
  }
  const toolchain = await toolchainEnvironment(root)
  for (const item of tasks) {
    item.env = { ...toolchain, ...item.env, ...topologyEnvironment(executionTopology) }
    if (item.kind === 'types') {
      await usePreparedTypeChecks(root, item)
    }
  }
  if (cliChanged) {
    const buildIndex = tasks.findIndex(item => item.id === 'build')
    if (buildIndex >= 0) {
      const split = await splitCliBuild(root, tasks[buildIndex]!)
      tasks.splice(buildIndex, 1, ...split.tasks)
      for (const item of tasks) {
        item.dependencies = item.dependencies.flatMap(id => id === 'build' ? split.terminalIds : [id])
        if (item.kind === 'typecheck' && item.args.includes('turbo')) {
          item.args.push('--only')
        }
      }
    }
  }
  for (const item of tasks) {
    item.resource ??= item.kind === 'runtime' ? 'machine-exclusive' : item.kind === 'build' || item.kind === 'types' ? 'workspace-write' : 'cpu'
    if (item.args.includes('turbo') || (['build', 'types'].includes(item.id) && mode === 'full')) {
      item.args.push('--summarize')
      item.evidence = 'turbo-summary'
    }
  }
  const configuration = await fingerprintConfiguration(root, packages)
  const budget = { cpus: resources.cpus, cpuBudget: resources.cpuBudget, jobs: resources.jobs, workersPerTask: resources.workersPerTask, buildConcurrency: resources.buildConcurrency }
  const fingerprint = createHash('sha256').update(JSON.stringify({ source: changes.fingerprint, mode, selection, executionTopology, tasks, remaining, toolchain, configuration, packages, budget })).digest('hex')
  return { version: 1, fingerprint, mode, selection, executionTopology, changes, resources, affected: [...affected].sort(), selected: selected.map(item => item.name).sort(), suggested: [...suggested].sort(), tasks, remaining, warnings }
}
