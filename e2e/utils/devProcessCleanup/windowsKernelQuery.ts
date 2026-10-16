import { rmSync } from 'node:fs'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 编译与查询均使用有界、受持有句柄管理的子进程。
import { execa } from 'execa'
import { resolveWechatInspectionTimeout } from '../../../packages/weapp-ide-cli/src/devtoolsTarget/inspection'
import { traceCleanupStage } from '../cleanupTrace'
import { runWithCleanup } from '../runWithCleanup'
import { traceWindowsQueryChild } from './windowsQueryChildTrace'

interface WindowsKernelQueryResult {
  stdout: string
  stderr: string
  exitCode?: number
  signal?: string
  timedOut?: boolean
}

let inspector: Promise<Uint8Array> | undefined

function remaining(deadline: number): number {
  const milliseconds = Math.floor(deadline - performance.now())
  if (milliseconds <= 0) {
    throw new Error('Windows kernel inspection exceeded its deadline before dispatch.')
  }
  return milliseconds
}

async function withInspectorDirectory<T>(operation: (directory: string) => Promise<T>): Promise<T> {
  const directory = await fs.mkdtemp(join(tmpdir(), 'weapp-dev-process-'))
  const onExit = () => {
    try {
      rmSync(directory, { recursive: true, force: true })
    }
    catch (error) {
      process.exitCode = Number(process.exitCode) || 1
      process.stderr.write(`Windows kernel inspector directory cleanup failed: ${String(error)}\n`)
    }
  }
  process.once('exit', onExit)
  return runWithCleanup(() => operation(directory), async () => {
    await fs.rm(directory, { recursive: true, force: true })
    process.removeListener('exit', onExit)
  })
}

async function compileInspector(deadline: number): Promise<Uint8Array> {
  // Windows worker 的环境变量副本区分大小写，不能假定宿主保留某一种键名拼写。
  const environmentKeys = Object.keys(process.env)
  const systemRootKey = environmentKeys.find(key => key.toLowerCase() === 'systemroot')
  const windirKey = environmentKeys.find(key => key.toLowerCase() === 'windir')
  const windowsRoot = (systemRootKey && process.env[systemRootKey]) || (windirKey && process.env[windirKey])
  if (!windowsRoot || !isAbsolute(windowsRoot)) {
    throw new Error('Windows kernel inspection requires an absolute Windows system directory.')
  }
  return withInspectorDirectory(async (directory) => {
    const executable = join(directory, 'snapshot.exe')
    const compiler = join(windowsRoot, 'Microsoft.NET', process.arch === 'ia32' ? 'Framework' : 'Framework64', 'v4.0.30319', 'csc.exe')
    const timeout = remaining(deadline)
    const result = await traceCleanupStage('dev-kernel-compile', () => execa(compiler, [
      '/nologo',
      '/codepage:65001',
      '/utf8output',
      '/optimize+',
      '/target:exe',
      '/platform:anycpu',
      `/out:${executable}`,
      fileURLToPath(new URL('./windowsKernelQuery.cs', import.meta.url)),
    ], { stdin: 'ignore', timeout, reject: false, windowsHide: true }), { timeoutMs: timeout })
    if (result.exitCode !== 0) {
      throw new Error(`Windows kernel inspector compilation failed: exitCode=${result.exitCode ?? 'none'}, signal=${result.signal ?? 'none'}, timedOut=${result.timedOut ?? false}.`, { cause: result })
    }
    return fs.readFile(executable)
  })
}

/** 冷编译计入原预算；只缓存成功产物的字节，每次查询返回前回收自己的可执行文件。 */
export async function queryWindowsKernelProcesses(pids?: readonly number[], trace = false): Promise<WindowsKernelQueryResult> {
  if (pids?.some(pid => !Number.isSafeInteger(pid) || pid <= 0 || pid > 0xFFFFFFFF)) {
    throw new TypeError('Windows process queries require positive 32-bit PIDs.')
  }
  if (process.platform !== 'win32') {
    throw new Error('Windows kernel inspection is only available on Windows.')
  }
  const startedMs = performance.now()
  const deadline = startedMs + resolveWechatInspectionTimeout('win32', 10_000)
  const args = trace ? ['--trace'] : []
  args.push(pids ? '--pids' : '--all')
  if (pids) {
    args.push(...new Set(pids.map(String)))
  }
  const compilation = inspector ??= compileInspector(deadline)
  let image: Uint8Array
  try {
    image = await compilation
  }
  catch (error) {
    if (inspector === compilation) {
      inspector = undefined
    }
    throw error
  }
  let result: WindowsKernelQueryResult | undefined
  try {
    return await withInspectorDirectory(async (directory) => {
      const executable = join(directory, 'snapshot.exe')
      await fs.writeFile(executable, image)
      const subprocess = execa(executable, args, {
        stdin: 'ignore',
        timeout: remaining(deadline),
        reject: false,
        windowsHide: true,
      })
      result = await (trace ? traceWindowsQueryChild(pids ? 'identities' : 'snapshot', subprocess, startedMs) : subprocess)
      return result
    })
  }
  catch (cleanupError) {
    // reject:false 的查询失败也是已结算的值；不能让随后的文件回收错误覆盖它。
    if (result && result.exitCode !== 0) {
      throw new AggregateError([result, cleanupError], 'Windows kernel query and cleanup both failed.', { cause: result })
    }
    throw cleanupError
  }
}

/** 旧 CIM 身份只有微秒精度；原始内核时间继续单独参与父子代次核验。 */
export function windowsLegacyProcessStarted(started: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{7})Z$/.exec(started)
  if (!match) {
    return
  }
  const milliseconds = Date.parse(`${match[1]}.000Z`)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== `${match[1]}.000Z`) {
    return
  }
  return `${match[1]}.${match[2]!.slice(0, 6)}0Z`
}
