import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { mutateLease } from '@weapp-vite/devtools-runtime'
import { defaultCustomConfigDirPath } from '../config/paths'
import { inspectWechatDevtoolsInstallation } from './installation'

export const defaultWechatDevtoolsRegistryPath = path.join(defaultCustomConfigDirPath, 'installations.json')

/** 登记只保存路径；安装渠道和版本每次从实际应用重新读取。 */
export async function readWechatDevtoolsRegistry(registryPath = defaultWechatDevtoolsRegistryPath): Promise<string[]> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(registryPath, 'utf8'))
    if (!Array.isArray(value) || !value.every(entry => typeof entry === 'string' && entry.trim())) {
      throw new Error('Invalid DevTools installation registry: expected CLI paths.')
    }
    return value
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function updateRegistry(registryPath: string, update: (paths: string[]) => string[]) {
  await fs.mkdir(path.dirname(registryPath), { recursive: true })
  await mutateLease(`${registryPath}.lock`, async () => {
    const paths = update(await readWechatDevtoolsRegistry(registryPath))
    const temporary = `${registryPath}.${process.pid}.tmp`
    try {
      await fs.writeFile(temporary, `${JSON.stringify(paths, null, 2)}\n`)
      await fs.rename(temporary, registryPath)
    }
    finally {
      await fs.rm(temporary, { force: true })
    }
  })
}

/** 校验安装后登记真实 CLI 路径，不更改默认选择或登录数据。 */
export async function registerWechatDevtoolsInstallation(cliPath: string, registryPath = defaultWechatDevtoolsRegistryPath) {
  const target = await inspectWechatDevtoolsInstallation(cliPath)
  await updateRegistry(registryPath, paths => [...new Set([...paths, target.cliPath])])
  return target
}

/** 允许移除已经失效的登记；不会删除应用或用户配置。 */
export async function unregisterWechatDevtoolsInstallation(cliPath: string, registryPath = defaultWechatDevtoolsRegistryPath) {
  const selected = await fs.realpath(cliPath).catch(() => path.resolve(cliPath))
  await updateRegistry(registryPath, paths => paths.filter(entry => entry !== selected && entry !== path.resolve(cliPath)))
}
