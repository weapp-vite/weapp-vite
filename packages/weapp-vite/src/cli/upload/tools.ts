import type { UploadContext } from './types'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { getPackageInfo } from 'local-pkg'
import logger from '../../logger'

export function requireUploadEnv(context: UploadContext, name: string): string {
  const value = context.env[name]?.trim()
  if (!value) {
    throw new Error(`上传缺少环境变量 ${name}。请通过环境变量或项目 .env 文件配置凭据。`)
  }
  return value
}

export function requireUploadAppId(context: UploadContext): string {
  const appid = context.appid?.trim()
  if (!appid || appid === 'touristappid') {
    throw new Error('上传需要目标平台的真实 AppID，请检查项目配置。')
  }
  return appid
}

export function redactUploadSecrets(message: string, secrets: readonly string[]): string {
  for (const secret of [...new Set(secrets)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join('[REDACTED]')
  }
  // 官方 SDK 会输出系统发现的代理 URL，不能只过滤已知上传密钥。
  return message.replace(/\b([a-z][a-z\d+.-]*:\/\/)[^\s/]+@/gi, '$1[REDACTED]@')
}

export async function loadUploadPackage<T>(specifier: string, cwd: string): Promise<T> {
  let resolved: string
  try {
    resolved = createRequire(path.join(cwd, 'package.json')).resolve(specifier)
  }
  catch {
    const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]
    throw new Error(`无法解析上传工具 ${specifier}，请在项目中安装：pnpm add -D ${packageName}`)
  }
  // 上传 SDK 是按平台安装的可选工具，必须从用户项目动态解析，不能静态打包。
  const loaded = await import(pathToFileURL(resolved).href)
  return (loaded.default ?? loaded) as T
}

/** 使用 Node 直接执行包入口，避免 Windows 的 .cmd 解析与 shell 引号差异。 */
export async function runUploadCli(context: UploadContext, packageName: string, binName: string, args: string[], secrets: string[], captureOutput = false): Promise<string> {
  const info = await getPackageInfo(packageName, { paths: [context.cwd] })
  const bins: unknown = info?.packageJson.bin
  const bin = typeof bins === 'string' ? bins : bins && typeof bins === 'object' ? (bins as Record<string, unknown>)[binName] : undefined
  if (!info || typeof bin !== 'string') {
    throw new Error(`无法解析上传工具 ${binName}，请在项目中安装：pnpm add -D ${packageName}`)
  }
  return new Promise<string>((resolve, reject) => {
    const child = execFile(process.execPath, [path.resolve(info.rootPath, bin), ...args], {
      cwd: context.cwd,
      env: context.env,
      maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8',
      windowsHide: true,
    }, (error, stdout, stderr) => {
      const safeOutput = redactUploadSecrets(`${stdout}\n${stderr}`, secrets).trim()
      if (error) {
        reject(new Error(`${packageName} 执行失败（${error.signal ?? error.code ?? 'unknown'}）${safeOutput ? `\n${safeOutput}` : ''}`))
        return
      }
      if (safeOutput && !captureOutput) {
        logger.info(safeOutput)
      }
      resolve(stdout)
    })
    function cancel() {
      // worker 即将退出，不能等待 CLI 的信号处理；强制结束自有进程，防止继续上传。
      child.kill('SIGKILL')
    }
    process.once('exit', cancel)
    child.once('close', () => process.off('exit', cancel))
    child.stdin?.end()
  })
}
