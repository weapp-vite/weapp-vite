/* eslint-disable e18e/ban-dependencies -- 平台 CLI doctor 需要跨平台进程退出码、超时和 stdio 控制。 */
import { access } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { PLATFORM_VERIFICATION_CAPABILITIES } from '../platforms/verification'

export interface PlatformRuntimeDiagnostic {
  id: string
  build: string
  ideCli: string
  runtimeAutomator: string
  ready: boolean
  reason: string
}

const DARWIN_CLI_CANDIDATES: Readonly<Record<string, readonly string[]>> = {
  weapp: ['/Applications/wechatwebdevtools.app/Contents/MacOS/cli'],
  swan: ['/Applications/百度开发者工具.app/Contents/Resources/app/bin/cli'],
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  }
  catch {
    return false
  }
}

async function commandExists(command: string) {
  try {
    const result = await execa(command, ['--version'], {
      env: process.env.WEAPP_VITE_PLATFORM_DOCTOR_PATH == null
        ? undefined
        : { PATH: process.env.WEAPP_VITE_PLATFORM_DOCTOR_PATH },
      reject: false,
      timeout: 10_000,
      stdio: 'ignore',
    })
    return typeof result.exitCode === 'number'
  }
  catch (error) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT')
  }
}

async function findCli(platform: string) {
  if (platform === 'alipay' && await commandExists('minidev')) {
    return 'minidev'
  }
  if (process.env.WEAPP_VITE_PLATFORM_DOCTOR_SKIP_DEFAULT_PATHS === '1') {
    return undefined
  }
  for (const candidate of DARWIN_CLI_CANDIDATES[platform] ?? []) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }
  return undefined
}

export async function diagnosePlatformRuntime(id: string): Promise<PlatformRuntimeDiagnostic> {
  const capability = PLATFORM_VERIFICATION_CAPABILITIES.find(item => item.id === id)
  if (!capability) {
    throw new Error(`未知平台：${id}`)
  }

  const cli = await findCli(id)
  const swanEndpoint = process.env.WEAPP_VITE_SWAN_WS_ENDPOINT?.trim()
  const ready = id === 'swan'
    ? Boolean(cli && swanEndpoint)
    : id === 'alipay'
      ? Boolean(cli)
      : id === 'weapp'
        ? Boolean(cli)
        : false
  const reason = ready
    ? `环境已就绪：${cli}`
    : id === 'swan' && cli && !swanEndpoint
      ? '已检测到百度开发者工具，但缺少 WEAPP_VITE_SWAN_WS_ENDPOINT。'
      : capability.limitation ?? `未检测到 ${id} 的可执行 IDE CLI。`

  return {
    id,
    build: capability.build,
    ideCli: capability.ideCli,
    runtimeAutomator: capability.runtimeAutomator,
    ready,
    reason,
  }
}

export async function runPlatformRuntimeDoctor(ids: readonly string[]) {
  return await Promise.all(ids.map(diagnosePlatformRuntime))
}

async function main() {
  const args = process.argv.slice(2)
  const requireIndex = args.indexOf('--require')
  const requiredId = requireIndex >= 0 ? args[requireIndex + 1] : undefined
  const ids = requiredId
    ? [requiredId]
    : PLATFORM_VERIFICATION_CAPABILITIES
        .filter(item => item.roadmap === 'target')
        .map(item => item.id)
  const diagnostics = await runPlatformRuntimeDoctor(ids)
  process.stdout.write(`${JSON.stringify({ diagnostics }, null, 2)}\n`)
  if (requiredId && diagnostics.some(item => !item.ready)) {
    process.exitCode = 1
  }
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

if (isDirectRun) {
  await main()
}
