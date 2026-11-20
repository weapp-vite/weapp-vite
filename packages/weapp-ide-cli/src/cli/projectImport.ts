import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
// eslint-disable-next-line e18e/ban-dependencies -- 官方入口需要跨平台参数传递与取消控制。
import { execa } from 'execa'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../devtoolsProjectOwnership'

const PROJECT_CLIENT_NAME = 'weapp-vite-e2e'
const WECHAT_SKILL_VERSION = '0.3.11'

interface ProjectImportOptions {
  cliPath: string
  projectPath: string
  trusted: boolean
  timeout: number
  signal: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readErrorCode(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    return value.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0]
  }
  if (isRecord(value)) {
    for (const key of ['code', 'errcode', 'error', 'message', 'reason']) {
      const code = readErrorCode(value[key])
      if (code !== undefined) {
        return code
      }
    }
  }
}

function describeProjectImportFailure(payload: unknown, projectPath: string) {
  const response = isRecord(payload) ? payload : undefined
  const result = response && isRecord(response.result) ? response.result : undefined
  const code = readErrorCode(response?.error)
    ?? readErrorCode(response?.code)
    ?? readErrorCode(response?.message)
    ?? readErrorCode(result?.error)
    ?? readErrorCode(result?.code)
    ?? readErrorCode(result?.message)
  const details = {
    responseKeys: response ? Object.keys(response).sort() : [],
    resultKeys: result ? Object.keys(result).sort() : [],
    ...(code === undefined ? {} : { code }),
    ...(typeof result?.status === 'string' ? { status: result.status } : {}),
    ...(typeof result?.success === 'boolean' ? { success: result.success } : {}),
    projectPathMatches: result?.projectPath === projectPath,
    alreadyImportedType: typeof result?.alreadyImported,
  }
  return JSON.stringify(details)
}

/** 使用同一安装的 skill 入口；Windows 由 execa 处理官方 cmd 包装器。 */
export function resolveProjectImportCli(cliPath: string, platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path.posix
  return paths.join(paths.dirname(cliPath), platform === 'win32' ? 'wechatide.cmd' : 'wechatide')
}

/** 官方导入会重写项目根、条件页和基础库选择；窗口启动前恢复原始输入。 */
async function preserveProjectConfig(projectPath: string, fileName: string, run: () => Promise<void>) {
  const file = path.join(projectPath, fileName)
  const original = await fs.readFile(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
  })
  let failure: unknown
  let failed = false
  try {
    await run()
  }
  catch (error) {
    failure = error
    failed = true
  }
  try {
    if (original) {
      const current = await fs.readFile(file).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error
        }
      })
      if (!current?.equals(original)) {
        await fs.writeFile(file, original)
      }
    }
    else {
      await fs.rm(file, { force: true })
    }
  }
  catch (error) {
    if (failed) {
      throw new AggregateError([failure, error], 'Official import failed and fixture config restoration did not complete')
    }
    throw error
  }
  if (failed) {
    throw failure
  }
}

/** 先完成官方项目导入，再启动受管窗口；导入不编译、不导航，也不修改私有能力记录。 */
export async function importManagedDevtoolsProject(options: ProjectImportOptions) {
  if (!options.trusted || !process.env[MANAGED_PROJECT_JOURNAL_ENV]) {
    return
  }
  options.signal.throwIfAborted()
  const projectPath = path.resolve(options.projectPath)
  const deadline = performance.now() + options.timeout
  const skillCli = resolveProjectImportCli(options.cliPath)
  const invoke = async (tool: string, ...args: string[]): Promise<unknown> => {
    options.signal.throwIfAborted()
    const remaining = Math.floor(deadline - performance.now())
    if (remaining <= 0) {
      throw new Error(`DEVTOOLS_PROJECT_IMPORT_TIMEOUT: 官方项目初始化在执行 ${tool} 前已耗尽预算`)
    }
    const { stdout } = await execa(skillCli, ['-c', PROJECT_CLIENT_NAME, tool, ...args], {
      timeout: remaining,
      cancelSignal: options.signal,
      // 入口可拉起共享宿主；取消仅终止命令，宿主由外层 runner 释放。
      killDescendants: false,
    })
    options.signal.throwIfAborted()
    return JSON.parse(stdout) as unknown
  }
  await withMachineE2ELease(async () => {
    // islogin 只读取登录标记。官方状态检查会同步主进程登录态，供导入查询 AppID 属性。
    const status = await invoke('check_wechatide_status', '--skill-version', WECHAT_SKILL_VERSION)
    const statusResult = isRecord(status) && isRecord(status.result) ? status.result : undefined
    if (isRecord(status) && status.ok === true && status.tool === 'check_wechatide_status'
      && status.clientName === PROJECT_CLIENT_NAME && statusResult?.loginExpired === true) {
      throw new Error('DEVTOOLS_LOGIN_REQUIRED: 微信开发者工具需要重新登录')
    }
    if (!isRecord(status) || status.ok !== true || status.tool !== 'check_wechatide_status'
      || status.clientName !== PROJECT_CLIENT_NAME || statusResult?.success !== true || statusResult.loginExpired !== false) {
      throw new Error(`DEVTOOLS_PROJECT_STATUS_UNAVAILABLE: 官方项目服务未就绪；receipt=${describeProjectImportFailure(status, projectPath)}`)
    }
    await preserveProjectConfig(projectPath, 'project.config.json', () => preserveProjectConfig(projectPath, 'project.private.config.json', async () => {
      const payload = await invoke('project_import', '--project', projectPath)
      const result = isRecord(payload) && isRecord(payload.result) ? payload.result : undefined
      if (!isRecord(payload) || payload.ok !== true || payload.tool !== 'project_import'
        || payload.clientName !== PROJECT_CLIENT_NAME || result?.success !== true
        || result.projectPath !== projectPath || typeof result.alreadyImported !== 'boolean'
        || result.taskId !== undefined || result.status !== undefined || result.error !== undefined) {
        throw new Error(`DEVTOOLS_PROJECT_IMPORT_INCOMPLETE: 官方项目导入未完成；receipt=${describeProjectImportFailure(payload, projectPath)}`)
      }
    }))
  })
}
