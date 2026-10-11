import type { ResolveWechatDevtoolsTargetOptions, WechatDevtoolsInstallation, WechatDevtoolsSelectionOptions } from './types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用跨平台子进程封装读取 Windows 安装登记。
import { execa } from 'execa'
import { readCustomConfig } from '../config/custom'
import { getDefaultCliPath } from '../runtime/platform'
import { withPowerShellUtf8Output } from '../utils/powershell'
import { inspectWechatDevtoolsInstallation } from './installation'
import { readWechatDevtoolsRegistry } from './registry'

/** 产品版本按数字段比较，避免日期版本的字符串排序漂移。 */
export function compareWechatDevtoolsVersions(a: string, b: string) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference) {
      return difference
    }
  }
  return 0
}

async function directories(root: string) {
  try {
    return await fs.readdir(root, { withFileTypes: true })
  }
  catch (error) {
    if (['ENOENT', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      return []
    }
    throw error
  }
}

async function windowsRegistryRoots() {
  const script = '$ErrorActionPreference=\'Stop\'; @(\'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*\',\'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*\',\'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*\') | ForEach-Object { Get-ItemProperty $_ -ErrorAction SilentlyContinue } | Where-Object { $_.DisplayName -match \'微信.*开发者|wechat.*devtools\' -and $_.InstallLocation } | Select-Object -ExpandProperty InstallLocation | ConvertTo-Json -Compress'
  const result = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', withPowerShellUtf8Output(script)], { reject: false, windowsHide: true, timeout: 10_000 })
  if (result.exitCode !== 0) {
    throw new Error('Unable to inspect Windows DevTools installation registry.')
  }
  const parsed: unknown = JSON.parse(result.stdout.trim() || '[]')
  const values = Array.isArray(parsed) ? parsed : [parsed]
  return values.filter((value): value is string => typeof value === 'string')
}

/** 只扫描已知安装根，不递归遍历磁盘，也不执行候选应用。 */
export async function listWechatDevtoolsInstallations(options: ResolveWechatDevtoolsTargetOptions = {}): Promise<WechatDevtoolsInstallation[]> {
  const platform = options.platform ?? process.platform
  const home = options.homeDir ?? os.homedir()
  const registered = await readWechatDevtoolsRegistry(options.registryPath)
  const config = await readCustomConfig()
  const candidates = new Set([...registered, config.cliPath, process.env.WEAPP_IDE_CLI_PATH].filter((value): value is string => !!value))
  const fallback = options.searchRoots || platform === 'linux' ? undefined : await getDefaultCliPath(platform === 'darwin' ? 'Darwin' : 'Windows_NT')
  if (fallback) {
    candidates.add(fallback)
  }
  const roots = options.searchRoots ?? (platform === 'darwin'
    ? ['/Applications', path.join(home, 'Applications')]
    : platform === 'win32'
      ? [process.env.ProgramFiles ?? 'C:\\Program Files', process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', options.localAppDataDir ?? process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local')]
      : [])
  if (platform === 'win32' && !options.searchRoots) {
    for (const root of await windowsRegistryRoots().catch(() => [])) {
      candidates.add(path.join(root, 'cli.bat'))
    }
  }
  const explicitCandidates = new Set(candidates)
  for (const root of roots) {
    const entries = await directories(root)
    if (platform === 'darwin') {
      for (const entry of entries.filter(entry => /\.app$/i.test(entry.name))) {
        const candidate = path.join(root, entry.name, 'Contents', 'MacOS', 'cli')
        if (await fs.stat(candidate).then(stat => stat.isFile(), () => false)) {
          candidates.add(candidate)
        }
      }
    }
    else if (platform === 'win32') {
      for (const directory of [root, ...entries.filter(entry => entry.isDirectory()).map(entry => path.join(root, entry.name))]) {
        for (const candidateRoot of [directory, ...(await directories(directory)).filter(entry => entry.isDirectory()).map(entry => path.join(directory, entry.name))]) {
          const candidate = path.join(candidateRoot, 'cli.bat')
          if (await fs.stat(candidate).then(stat => stat.isFile(), () => false)) {
            candidates.add(candidate)
          }
        }
      }
    }
  }
  const seen = new Set<string>()
  const result: WechatDevtoolsInstallation[] = []
  for (const cliPath of candidates) {
    try {
      const target = await inspectWechatDevtoolsInstallation(cliPath, options)
      if (!seen.has(target.installationId)) {
        seen.add(target.installationId)
        result.push({ cliPath: target.cliPath, target })
      }
    }
    catch (error) {
      if (!explicitCandidates.has(cliPath)) {
        continue
      }
      if ((error as { code?: string }).code === 'WECHAT_DEVTOOLS_UNRELATED_APPLICATION'
        && !registered.includes(cliPath) && cliPath !== config.cliPath && cliPath !== process.env.WEAPP_IDE_CLI_PATH) {
        continue
      }
      result.push({ cliPath, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return result.sort((a, b) => compareWechatDevtoolsVersions(b.target?.version ?? '0', a.target?.version ?? '0') || a.cliPath.localeCompare(b.cliPath))
}

/** 渠道必须显式 opt-in；找不到或存在同版本歧义时不静默换安装。 */
export async function selectInstalledWechatDevtools(options: ResolveWechatDevtoolsTargetOptions & WechatDevtoolsSelectionOptions = {}) {
  const channel = options.devtoolsChannel ?? (options.devtoolsVersion ? undefined : 'stable')
  const matches = (await listWechatDevtoolsInstallations(options)).flatMap(entry => entry.target?.version
    && (!channel || entry.target.channel === channel)
    && (!options.devtoolsVersion || entry.target.version === options.devtoolsVersion)
    ? [entry.target]
    : [])
  if (!matches.length) {
    throw Object.assign(new Error(`No installed WeChat DevTools matches ${channel ?? 'any channel'}${options.devtoolsVersion ? `@${options.devtoolsVersion}` : ''}. Register its CLI with weapp devtools add <path-to-cli>.`), { code: 'WECHAT_DEVTOOLS_INSTALLATION_NOT_FOUND' })
  }
  if (matches.filter(target => compareWechatDevtoolsVersions(target.version!, matches[0]!.version!) === 0).length !== 1) {
    throw Object.assign(new Error('Multiple DevTools installations match the selected version. Specify --cli-path.'), { code: 'WECHAT_DEVTOOLS_INSTALLATION_AMBIGUOUS' })
  }
  return matches[0]!
}
