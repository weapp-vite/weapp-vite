import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- CI 类型检查复用已核验产物，跨平台启动 Turbo。
import { execa } from 'execa'

/** 先展开原类型任务图，再显式选中所有类型依赖，禁止消费者重新调度 build。 */
export async function ciTypePlan(root, execute = execa) {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const arguments_ = manifest.scripts['test:types'].trim().split(/\s+/u)
  assert.deepEqual(arguments_.slice(0, 3), ['turbo', 'run', 'test:types:check'], 'Unsupported root type-contract entry')
  const filters = arguments_.slice(3)
  assert(filters.length > 0 && filters.every(value => value.startsWith('--filter=')), 'Unsupported type-contract selection')
  const dry = async args => JSON.parse((await execute('pnpm', ['exec', 'turbo', 'run', 'test:types:check', ...args, '--dry=json'], { cwd: root })).stdout)
  const baseline = await dry(filters)
  const required = baseline.tasks.filter(task => task.task === 'test:types:check' && task.command !== '<NONEXISTENT>')
  assert(required.length > 0, 'Empty type-contract graph')
  const targets = [...new Set(required.map(task => task.package))].sort()
  const args = [...targets.map(target => `--filter=${target}`), '--only']
  const only = await dry(args)
  assert(only.tasks.every(task => task.task === 'test:types:check'), 'CI type graph must not contain build tasks')
  const taskIds = tasks => tasks.filter(task => task.command !== '<NONEXISTENT>').map(task => task.taskId).sort()
  assert.deepEqual(taskIds(only.tasks), taskIds(required), 'Incomplete CI type-contract graph')
  return { schemaVersion: 1, rootCommand: manifest.scripts['test:types'], baselineTasks: baseline.tasks.length, targets, taskIds: taskIds(required), buildTasks: 0, args: ['exec', 'turbo', 'run', 'test:types:check', ...args] }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert(process.argv.slice(2).every(value => value === '--dry'), 'Expected optional --dry')
  const root = process.cwd()
  const plan = await ciTypePlan(root)
  await mkdir(path.join(root, '.tmp'), { recursive: true })
  await writeFile(path.join(root, '.tmp/ci-type-contracts-plan.json'), `${JSON.stringify(plan, null, 2)}\n`)
  process.stdout.write(`CI type graph: ${plan.taskIds.length} complete contracts; ${plan.buildTasks} build tasks\n`)
  if (!process.argv.includes('--dry')) {
    await execa('pnpm', plan.args, { cwd: root, stdio: 'inherit' })
  }
}
