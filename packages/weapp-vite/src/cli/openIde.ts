import type { MpPlatform } from '../types'
import path from 'pathe'
import { parse } from 'weapp-ide-cli'
import logger from '../logger'

export async function openIde(platform?: MpPlatform, projectPath?: string) {
  const argv = ['open', '-p']
  if (projectPath) {
    argv.push(projectPath)
  }
  if (platform === 'alipay') {
    argv.push('--platform', platform)
  }

  try {
    await parse(argv)
  }
  catch (error) {
    logger.error(error)
  }
}

/**
 * @description 根据 mpDistRoot 推导 IDE 项目目录（目录内应包含 project/mini 配置）
 */
export function resolveIdeProjectPath(mpDistRoot?: string) {
  if (!mpDistRoot || !mpDistRoot.trim()) {
    return undefined
  }
  const parent = path.dirname(mpDistRoot)
  if (!parent || parent === '.') {
    return undefined
  }
  return parent
}
