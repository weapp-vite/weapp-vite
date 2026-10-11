import type { ResolvedWechatDevtoolsTarget, ResolveWechatDevtoolsTargetOptions, WechatDevtoolsSelectionOptions } from './types'
import fs from 'node:fs/promises'
import process from 'node:process'
import { readCustomConfig } from '../config/custom'
import { wechatDevtoolsSelectionContext } from './context'
import { selectInstalledWechatDevtools } from './discovery'
import { inspectWechatDevtoolsInstallation } from './installation'
import { assertOfficialWechatDevtoolsVersion } from './official'

export { compareWechatDevtoolsVersions, listWechatDevtoolsInstallations } from './discovery'
export { assertWechatDevtoolsHost, assertWechatDevtoolsPort, type WechatDevtoolsHostInspectionOptions } from './host'
export { assertOfficialWechatDevtoolsVersion, readOfficialWechatDevtoolsVersion, WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL } from './official'
export { registerWechatDevtoolsInstallation, unregisterWechatDevtoolsInstallation } from './registry'
export type * from './types'

function conflict(message: string): never {
  throw Object.assign(new Error(message), { code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
}

export function validateWechatDevtoolsSelection(options: WechatDevtoolsSelectionOptions) {
  if (options.cliPath !== undefined && !options.cliPath.trim()) {
    throw new Error('cliPath must not be empty.')
  }
  if (options.devtoolsChannel !== undefined && !['stable', 'rc', 'nightly'].includes(options.devtoolsChannel)) {
    throw new Error('devtoolsChannel must be stable, rc or nightly.')
  }
  if (options.devtoolsVersion !== undefined && !/^\d+(?:\.\d+){2,}$/.test(options.devtoolsVersion)) {
    throw new Error('devtoolsVersion must be a complete DevTools product version.')
  }
}

async function assertSelection(target: ResolvedWechatDevtoolsTarget, options: WechatDevtoolsSelectionOptions) {
  if (options.cliPath?.trim() && await fs.realpath(options.cliPath.trim()) !== await fs.realpath(target.cliPath)) {
    conflict('The explicit CLI path conflicts with the selected DevTools installation; no installation was changed.')
  }
  if (options.devtoolsChannel && options.devtoolsChannel !== target.channel) {
    conflict('The requested DevTools channel conflicts with the selected installation.')
  }
  if (options.devtoolsVersion && options.devtoolsVersion !== target.version) {
    conflict('The requested DevTools version conflicts with the selected installation.')
  }
  if (options.requireOfficialLatest) {
    await assertOfficialWechatDevtoolsVersion(target)
  }
  return target
}

export function readWechatDevtoolsSelectionEnvironment(env = process.env): WechatDevtoolsSelectionOptions {
  const options = {
    cliPath: env.WEAPP_IDE_CLI_PATH?.trim() || undefined,
    devtoolsChannel: (env.WEAPP_IDE_DEVTOOLS_CHANNEL?.trim() || undefined) as WechatDevtoolsSelectionOptions['devtoolsChannel'],
    devtoolsVersion: env.WEAPP_IDE_DEVTOOLS_VERSION?.trim() || undefined,
    requireOfficialLatest: env.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST === '1',
  }
  validateWechatDevtoolsSelection(options)
  return options
}

/** 每次操作只解析一次安装，显式选择覆盖继承的配置但不写回全局设置。 */
export async function resolveWechatDevtoolsTarget(options: ResolveWechatDevtoolsTargetOptions = {}): Promise<ResolvedWechatDevtoolsTarget> {
  validateWechatDevtoolsSelection(options)
  const active = wechatDevtoolsSelectionContext.getStore()
  if (active && options.target && active.installationId !== options.target.installationId) {
    conflict('The fixed target conflicts with the active operation installation.')
  }
  const frozen = active ?? options.target
  if (frozen) {
    return await assertSelection(frozen, options)
  }
  let selection: WechatDevtoolsSelectionOptions = { ...options }
  if (!options.cliPath?.trim() && !options.devtoolsChannel && !options.devtoolsVersion) {
    selection = readWechatDevtoolsSelectionEnvironment()
    selection.requireOfficialLatest = options.requireOfficialLatest ?? selection.requireOfficialLatest
    if (!selection.cliPath && !selection.devtoolsChannel && !selection.devtoolsVersion) {
      selection = { ...selection, cliPath: (await readCustomConfig()).cliPath }
    }
  }
  selection.requireOfficialLatest ??= process.env.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST === '1'
  const target = selection.cliPath?.trim()
    ? await inspectWechatDevtoolsInstallation(selection.cliPath.trim(), options)
    : await selectInstalledWechatDevtools({ ...options, ...selection })
  return await assertSelection(target, selection)
}

/** 命令的所有异步阶段复用同一安装，彼此并发的调用不会污染环境变量。 */
export async function withWechatDevtoolsSelection<T>(options: ResolveWechatDevtoolsTargetOptions, runner: (target: ResolvedWechatDevtoolsTarget) => Promise<T>): Promise<T> {
  const target = await resolveWechatDevtoolsTarget(options)
  return await wechatDevtoolsSelectionContext.run(target, () => runner(target))
}

/** 读取当前操作固定的安装；没有活动选择时不触发发现或启动。 */
export function getActiveWechatDevtoolsTarget() {
  return wechatDevtoolsSelectionContext.getStore()
}
