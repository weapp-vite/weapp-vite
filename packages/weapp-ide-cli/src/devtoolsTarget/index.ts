import type { WechatDevtoolsMetadata } from './metadata'
import type { WechatDevtoolsProfileOptions } from './profile'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { getConfig } from '../config/resolver'
import { readWechatDevtoolsMetadata } from './metadata'
import { resolveWechatDevtoolsProfileDir } from './profile'

export { assertWechatDevtoolsHost, assertWechatDevtoolsPort, type WechatDevtoolsHostInspectionOptions } from './host'

export interface ResolvedWechatDevtoolsTarget extends WechatDevtoolsMetadata {
  cliPath: string
  installationId: string
  appPath: string
  profileDir: string
}

export interface ResolveWechatDevtoolsTargetOptions extends WechatDevtoolsProfileOptions {
  cliPath?: string
  target?: ResolvedWechatDevtoolsTarget
}

async function resolveApplicationPath(cliPath: string, platform: NodeJS.Platform) {
  const root = platform === 'darwin' && path.basename(path.dirname(cliPath)) === 'MacOS'
    ? path.join(path.dirname(path.dirname(cliPath)), 'Resources')
    : path.dirname(cliPath)
  const candidates = platform === 'darwin'
    ? [path.join(root, 'app.asar'), path.join(root, 'app'), path.join(root, 'package.nw')]
    : [path.join(root, 'resources', 'app.asar'), path.join(root, 'resources', 'app'), path.join(root, 'package.nw'), path.join(root, 'resources', 'package.nw')]
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate)
      if (candidate.endsWith('.asar') ? stat.isFile() : stat.isDirectory()) {
        return await fs.realpath(candidate)
      }
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
  throw new Error('Cannot identify the selected WeChat DevTools installation. Select its official CLI path.')
}

/** 一次解析 CLI、应用身份及配置目录，供本次操作的所有阶段共同使用。 */
export async function resolveWechatDevtoolsTarget(options: ResolveWechatDevtoolsTargetOptions = {}): Promise<ResolvedWechatDevtoolsTarget> {
  if (options.target) {
    const explicitCliPath = options.cliPath?.trim()
    if (explicitCliPath && explicitCliPath !== options.target.cliPath) {
      const [explicit, selected] = await Promise.all([fs.realpath(explicitCliPath), fs.realpath(options.target.cliPath)])
      if (explicit !== selected) {
        throw Object.assign(new Error('The explicit CLI path conflicts with the selected DevTools installation; no installation was changed.'), { code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
      }
    }
    return options.target
  }
  const selected = options.cliPath?.trim() || (await getConfig()).cliPath
  if (!selected) {
    throw new Error('No WeChat DevTools CLI has been selected.')
  }
  const cliPath = await fs.realpath(selected)
  if (!(await fs.stat(cliPath)).isFile()) {
    throw new Error('The selected WeChat DevTools CLI is not a file.')
  }
  const appPath = await resolveApplicationPath(cliPath, options.platform ?? process.platform)
  const metadata = await readWechatDevtoolsMetadata(appPath)
  return {
    cliPath,
    appPath,
    installationId: createHash('sha256').update(appPath).digest('hex'),
    profileDir: resolveWechatDevtoolsProfileDir(appPath, options),
    ...metadata,
  }
}
