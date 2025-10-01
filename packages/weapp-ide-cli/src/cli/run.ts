import type { ArgvTransform } from '../utils'
import logger from '../logger'
import {
  isOperatingSystemSupported,
  operatingSystemName,
} from '../runtime/platform'
import {

  createAlias,
  createPathCompat,
  execute,
  transformArgv,
} from '../utils'
import { promptForCliPath } from './prompt'
import { resolveCliPath } from './resolver'

const ARG_TRANSFORMS: readonly ArgvTransform[] = [
  createAlias({ find: '-p', replacement: '--project' }),
  createPathCompat('--result-output'),
  createPathCompat('-r'),
  createPathCompat('--qr-output'),
  createPathCompat('-o'),
  createPathCompat('--info-output'),
  createPathCompat('-i'),
]

export async function parse(argv: string[]) {
  if (!isOperatingSystemSupported(operatingSystemName)) {
    logger.log(`微信web开发者工具不支持当前平台：${operatingSystemName} !`)
    return
  }

  if (argv[0] === 'config') {
    await promptForCliPath()
    return
  }

  const { cliPath, source } = await resolveCliPath()

  if (!cliPath) {
    const message
      = source === 'custom'
        ? '在当前自定义路径中未找到微信web开发者命令行工具，请重新指定路径。'
        : '未检测到微信web开发者命令行工具，请执行 `weapp-ide-cli config` 指定路径。'
    logger.log(message)
    await promptForCliPath()
    return
  }

  const formattedArgv = transformArgv(argv, ARG_TRANSFORMS)

  await execute(cliPath, formattedArgv)
}
