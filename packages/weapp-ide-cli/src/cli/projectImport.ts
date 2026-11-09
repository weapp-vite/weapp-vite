import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
// eslint-disable-next-line e18e/ban-dependencies -- 官方入口需要跨平台参数传递与取消控制。
import { execa } from 'execa'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../devtoolsProjectOwnership'

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
  await withMachineE2ELease(() => preserveProjectConfig(projectPath, 'project.config.json', () => preserveProjectConfig(projectPath, 'project.private.config.json', async () => {
    options.signal.throwIfAborted()
    const { stdout } = await execa(resolveProjectImportCli(options.cliPath), [
      '-c',
      'weapp-vite-e2e',
      'project_import',
      '--project',
      projectPath,
    ], {
      timeout: options.timeout,
      cancelSignal: options.signal,
      // 入口可拉起共享宿主；取消仅终止命令，宿主由外层 runner 释放。
      killDescendants: false,
    })
    const payload: unknown = JSON.parse(stdout)
    const result = isRecord(payload) && isRecord(payload.result) ? payload.result : undefined
    if (!isRecord(payload) || payload.ok !== true || payload.tool !== 'project_import'
      || payload.clientName !== 'weapp-vite-e2e' || result?.success !== true
      || result.projectPath !== projectPath || typeof result.alreadyImported !== 'boolean'
      || result.taskId !== undefined || result.status !== undefined || result.error !== undefined) {
      throw new Error(`DEVTOOLS_PROJECT_IMPORT_INCOMPLETE: 官方项目导入未完成；receipt=${describeProjectImportFailure(payload, projectPath)}`)
    }
    options.signal.throwIfAborted()
  })))
}
