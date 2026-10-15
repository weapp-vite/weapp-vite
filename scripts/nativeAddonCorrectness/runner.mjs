import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 需要固定 shell:false 的跨平台命令调用。
import { execa } from 'execa'
import { hashAddonFiles, loadedAddonFiles } from './addon.mjs'
import { bindingIdentity, currentPlan, frozenPlan, readJson, requireBinding, writeJson } from './evidence.mjs'
import { verifyNativeExports, verifyNativeReport } from './gate.mjs'
import { candidateFile } from './manifest.mjs'

/** 所有构建过滤合并成一个依赖图执行，避免重建共享 compiler/npm 闭包。 */
export function correctnessCommands(plan, root, directory) {
  return [
    {
      command: 'pnpm',
      args: ['exec', 'turbo', 'run', 'build', ...plan.manifest.buildFilters.map(filter => `--filter=${filter}`), '--concurrency=1', '--force'],
      cwd: root,
    },
    {
      command: 'pnpm',
      args: ['exec', 'vitest', 'run', '--config', 'native.vitest.config.ts', ...plan.manifest.suites.map(suite => suite.file), '--maxWorkers=1', '--no-file-parallelism', '--reporter=default', '--reporter=json', `--outputFile=${path.join(directory, 'raw-vitest.json')}`],
      cwd: path.join(root, 'packages/ast-native'),
    },
  ]
}

function portableCommands(plan) {
  return {
    buildFilters: plan.manifest.buildFilters,
    buildOptions: { force: true, concurrency: 1 },
    suiteFiles: plan.manifest.suites.map(suite => suite.file),
  }
}

/** driver 只执行受限清单，不读取候选 YAML，也不执行候选 verifier。 */
export async function runCorrectness(mode, root, directory, {
  commit,
  loadBinding = async file => import(pathToFileURL(file).href),
  findAddonFiles = loadedAddonFiles,
  execute = item => execa(item.command, item.args, { cwd: item.cwd, stdio: 'inherit', shell: false }),
} = {}) {
  if (!['plan', 'binding', 'run', 'report'].includes(mode)) {
    throw new Error('Unknown native correctness mode')
  }
  await mkdir(directory, { recursive: true })
  if (mode === 'plan') {
    await Promise.all(['plan.json', 'binding.json', 'execution.json', 'summary.json', 'raw-vitest.json']
      .map(name => rm(path.join(directory, name), { force: true })))
    const plan = await currentPlan(root, commit)
    await writeJson(directory, 'plan.json', plan)
    return plan
  }
  const plan = await frozenPlan(root, directory, commit)
  if (mode === 'binding') {
    await rm(path.join(directory, 'binding.json'), { force: true })
    const file = await candidateFile(root, 'packages/ast-native/index.js')
    const exports = verifyNativeExports(await loadBinding(file), plan.manifest)
    const addonFiles = await hashAddonFiles(root, await findAddonFiles(root, file))
    await writeJson(directory, 'binding.json', { status: 'passed', ...bindingIdentity(plan), exports, addonFiles })
    return
  }
  const addonFiles = await requireBinding(root, directory, plan)
  if (mode === 'run') {
    await Promise.all(['execution.json', 'raw-vitest.json', 'summary.json'].map(name => rm(path.join(directory, name), { force: true })))
    const commands = correctnessCommands(plan, root, directory)
    const execution = { ...bindingIdentity(plan), ...portableCommands(plan), build: 'running', tests: 'not-run' }
    await writeJson(directory, 'execution.json', execution)
    try {
      await execute(commands[0])
      await frozenPlan(root, directory, commit)
      await requireBinding(root, directory, plan)
      execution.build = 'passed'
      execution.tests = 'running'
      await writeJson(directory, 'execution.json', execution)
      await execute(commands[1])
      await frozenPlan(root, directory, commit)
      await requireBinding(root, directory, plan)
      execution.tests = 'passed'
    }
    catch (error) {
      if (execution.build === 'passed') {
        execution.tests = 'failed'
      }
      else {
        execution.build = 'failed'
      }
      throw error
    }
    finally {
      await writeJson(directory, 'execution.json', execution)
    }
    return
  }
  const execution = await readJson(directory, 'execution.json')
  const expected = { ...bindingIdentity(plan), ...portableCommands(plan), build: 'passed', tests: 'passed' }
  if (!isDeepStrictEqual(execution, expected)) {
    throw new Error('Fresh native correctness build or test execution did not complete')
  }
  const report = await readJson(directory, 'raw-vitest.json')
  const summary = verifyNativeReport(report, path.join(root, 'packages/ast-native'), plan.manifest)
  await writeJson(directory, 'summary.json', { ...summary, ...bindingIdentity(plan), ...portableCommands(plan), addonFiles })
}
