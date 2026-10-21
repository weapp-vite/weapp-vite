import type { VerificationTask } from './types.ts'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 从真实 Turbo dry graph 推导顺序，保留跨平台命令处理。
import { execa } from 'execa'

interface BuildNode {
  taskId: string
  task: string
  package: string
  command: string
  hash: string
  dependencies: string[]
}

async function dryBuild(root: string, task: VerificationTask): Promise<BuildNode[]> {
  let args = task.args.slice(2)
  if (task.args[0] === 'run') {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    const script = manifest.scripts[task.args[1]!]!
    if (!/^turbo\s/.test(script) || /[;&|]/.test(script)) {
      throw new Error('构建包装命令不能安全转换为 Turbo 任务图')
    }
    args = [...script.trim().split(/\s+/).slice(1), ...task.args.slice(2)]
  }
  const result = await execa(process.execPath, [createRequire(import.meta.url).resolve('turbo/bin/turbo'), ...args, '--dry=json'], { cwd: root, env: task.env })
  const parsed: unknown = JSON.parse(result.stdout)
  const nodes = (parsed as { tasks?: BuildNode[] }).tasks
  if (!Array.isArray(nodes) || nodes.some(node => [node.taskId, node.task, node.package, node.command, node.hash].some(value => typeof value !== 'string') || !Array.isArray(node.dependencies))) {
    throw new Error('Turbo dry graph 缺少可冻结的构建依赖')
  }
  return nodes
}

/** 用真实任务图分层，CLI 仅在自身节点执行一次明确命令；其余节点继续使用 Turbo 缓存。 */
export async function splitCliBuild(root: string, original: VerificationTask): Promise<{ tasks: VerificationTask[], terminalIds: string[] }> {
  const nodes = await dryBuild(root, original)
  if (!nodes.some(node => node.taskId === 'weapp-vite#build')) {
    throw new Error('CLI 源码发生变更，但构建图没有 weapp-vite#build')
  }
  const resolved = new Set<string>()
  const tasks: VerificationTask[] = []
  let previous: string[] = []
  let layer = 0
  while (resolved.size < nodes.length) {
    const ready = nodes.filter(node => !resolved.has(node.taskId) && node.dependencies.every(id => resolved.has(id)))
    if (!ready.length) {
      throw new Error('Turbo 构建图包含缺失依赖或循环')
    }
    const current: VerificationTask[] = []
    const grouped = new Map<string, BuildNode[]>()
    for (const node of ready) {
      if (node.taskId === 'weapp-vite#build') {
        current.push({ ...original, id: 'dist-sync:weapp-vite', args: ['--filter', 'weapp-vite', 'build'], dependencies: previous, reason: '在已构建上游之后只执行一次 CLI dist sync', evidence: undefined })
      }
      else if (node.command !== '<NONEXISTENT>') {
        grouped.set(node.task, [...grouped.get(node.task) ?? [], node])
      }
      resolved.add(node.taskId)
    }
    for (const [taskName, group] of grouped) {
      // --only 会移除 Turbo 的依赖 hash；显式传入原图 hash，确保上游变化仍使缓存失效。
      const graphHash = createHash('sha256').update(JSON.stringify(group.map(node => [node.taskId, node.hash]).sort())).digest('hex')
      current.push({ ...original, id: `build:layer:${layer}:${taskName}`, args: ['exec', 'turbo', 'run', taskName, ...group.map(node => `--filter=${node.package}`), '--only', ...original.args.filter(arg => arg.startsWith('--concurrency='))], env: { ...original.env, WEAPP_VITE_VERIFY_BUILD_GRAPH_HASH: graphHash }, dependencies: previous, reason: '真实 Turbo 图的同层节点；冻结原依赖 hash，--only 防止再次构建 CLI' })
    }
    tasks.push(...current)
    if (current.length) {
      previous = current.map(task => task.id)
    }
    layer++
  }
  return { tasks, terminalIds: previous }
}

/** 共享准备范围复用既有根构建策略，负例与应用产物继续由各自测试拥有。 */
export async function sharedBuildPackages(root: string, fallback: string[], script = 'build:pkgs'): Promise<Set<string>> {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  if (!manifest.scripts?.[script]) {
    return new Set(fallback)
  }
  const nodes = await dryBuild(root, { id: 'scope', kind: 'build', command: 'pnpm', args: ['run', script], directory: '.', dependencies: [], reason: '继承既有共享构建范围' })
  return new Set(nodes.filter(node => node.task === 'build').map(node => node.package))
}

/** 先读取原类型任务闭包，再只执行类型节点；已准备的 build 不会被 dependsOn 重加。 */
export async function usePreparedTypeChecks(root: string, original: VerificationTask): Promise<void> {
  const nodes = await dryBuild(root, original)
  const checks = nodes.filter(node => node.task === 'test:types:check' && node.command !== '<NONEXISTENT>')
  original.args = ['exec', 'turbo', 'run', 'test:types:check', ...checks.map(node => `--filter=${node.package}`), '--only', ...original.args.filter(arg => arg.startsWith('--concurrency='))]
}
