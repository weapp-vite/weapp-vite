import type { ResolvedWechatDevtoolsTarget, ResolveWechatDevtoolsTargetOptions } from './types'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { readWechatDevtoolsMetadata } from './metadata'
import { resolveWechatDevtoolsProfileDir } from './profile'

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

/** 只读取明确路径的安装元数据，不读取配置或启动宿主。 */
export async function inspectWechatDevtoolsInstallation(selected: string, options: ResolveWechatDevtoolsTargetOptions = {}): Promise<ResolvedWechatDevtoolsTarget> {
  const cliPath = await fs.realpath(selected)
  if (!(await fs.stat(cliPath)).isFile()) {
    throw new Error('The selected WeChat DevTools CLI is not a file.')
  }
  const appPath = await resolveApplicationPath(cliPath, options.platform ?? process.platform)
  return {
    cliPath,
    appPath,
    installationId: createHash('sha256').update(appPath).digest('hex'),
    profileDir: resolveWechatDevtoolsProfileDir(appPath, options),
    ...await readWechatDevtoolsMetadata(appPath),
  }
}
