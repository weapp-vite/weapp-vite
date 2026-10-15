import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// pnpm.cmd 解析和取消时的子进程终结使用同一跨平台执行器。
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { compilerCases } from './cases'
import { defaultAddonPath, freezeIdentity, freezeSourceIdentity } from './identity'
import { assertProjectPreparation, createPreparationPlan } from './preparationPlan'

/** 构建与采样分开执行；只有完整串行 release 构建成功才写冻结回执。 */
async function prepareOwnedCompilerProfile(root: string, environment: NodeJS.ProcessEnv, signal: AbortSignal) {
  const output = path.join(root, '.tmp/real-compiler-entry-profile/build-receipt.json')
  await rm(output, { force: true })
  const source = await freezeSourceIdentity(root, compilerCases)
  const commands = createPreparationPlan(compilerCases)
  for (const command of commands) {
    const result = await execa(command.command === 'node' ? process.execPath : command.command, command.args, {
      cwd: path.resolve(root, command.cwd),
      env: environment,
      cancelSignal: signal,
    })
    process.stderr.write(`${result.stdout}\n${result.stderr}\n`)
    assertProjectPreparation(command, result.stdout, result.stderr)
  }
  const frozen = await freezeIdentity(root, compilerCases, defaultAddonPath(root))
  if (source.commit !== frozen.commit || source.sourceDigest !== frozen.sourceDigest) {
    throw new Error('Source changed during package preparation; rebuild before profiling.')
  }
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify({ schemaVersion: 1, status: 'passed', release: true, commands, node: process.version, frozen }, null, 2)}\n`)
  return output
}

export async function prepareCompilerProfile(root: string) {
  const { withMachineE2ELease } = await import('../../packages/devtools-runtime/src/lease/machine')
  const { createSuiteSignalScope } = await import('../../e2e/scripts/suiteRunner/signals')
  const scope = createSuiteSignalScope()
  try {
    return await withMachineE2ELease(lease => prepareOwnedCompilerProfile(root, lease.environment, scope.signal))
  }
  finally {
    scope.dispose()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  void prepareCompilerProfile(root).then(output => process.stdout.write(`${output}\n`)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
