import type { MpPlatform } from '@weapp-core/shared'
import type { InlineConfig } from 'vite'
import path from 'node:path'
import { getDefaultMiniProgramPlatform, getMiniProgramPlatformDescriptor, getSupportedMiniProgramPlatforms, resolveMiniProgramPlatform } from '@weapp-core/shared'
import { resolveMultiPlatformConfig } from '../../packages/weapp-vite/src/multiPlatform'
import { getSourceStyleExtensions, getSourceTemplateExtensions } from '../../packages/weapp-vite/src/platforms/sourceAssets'

export const WORKSPACE_HMR_TARGET_PREFIX = '[workspace-hmr-target]'

/** 只解析实际开发进程已合并的配置，不执行配置文件或改变父进程环境。 */
export function resolveWorkspaceHmrProjectTarget(config: Pick<InlineConfig, 'weapp'>) {
  const configured = config.weapp?.platform
  const platform = configured === undefined ? getDefaultMiniProgramPlatform() : resolveMiniProgramPlatform(configured)
  if (!platform) {
    throw new Error(`Workspace HMR has an unsupported mini-program target: ${String(configured)}`)
  }
  const multiPlatform = resolveMultiPlatformConfig(config.weapp?.multiPlatform)
  if (multiPlatform.enabled && !multiPlatform.targets.includes(platform)) {
    throw new Error(`Workspace HMR target ${platform} is not included in weapp.multiPlatform.targets.`)
  }
  return platform
}

/** 只接收当前受管子进程的一份完整回执，重复或身份变化均停止验收。 */
export function readWorkspaceHmrProjectTarget(output: string, identity: { id: string, pid: number | undefined }) {
  const lines = output.split(/\r?\n/).filter(line => line.startsWith(WORKSPACE_HMR_TARGET_PREFIX))
  if (!lines.length) {
    return undefined
  }
  if (lines.length !== 1) {
    throw new Error('Workspace HMR received duplicate project target receipts.')
  }
  const receipt: unknown = JSON.parse(lines[0]!.slice(WORKSPACE_HMR_TARGET_PREFIX.length))
  if (!receipt || typeof receipt !== 'object'
    || !('id' in receipt) || receipt.id !== identity.id
    || !('pid' in receipt) || receipt.pid !== identity.pid
    || !('platform' in receipt) || typeof receipt.platform !== 'string'
    || resolveMiniProgramPlatform(receipt.platform) !== receipt.platform
    || !('distRoot' in receipt) || typeof receipt.distRoot !== 'string' || !path.isAbsolute(receipt.distRoot)) {
    throw new Error('Workspace HMR project target receipt does not match the managed development process.')
  }
  return { platform: receipt.platform as MpPlatform, distRoot: receipt.distRoot }
}

/** 同一入口只修改构建器实际选择的源码，目标原生后缀优先于便携回退。 */
export function selectWorkspaceHmrSourceFiles(files: readonly string[], platform: MpPlatform, kind: 'template' | 'style') {
  const extensions = kind === 'template' ? getSourceTemplateExtensions(platform) : getSourceStyleExtensions(platform)
  const selected = new Map<string, { file: string, rank: number }>()
  for (const file of files) {
    const extension = path.extname(file)
    const rank = extensions.indexOf(extension.slice(1))
    if (rank < 0) {
      continue
    }
    const owner = file.slice(0, -extension.length)
    const previous = selected.get(owner)
    if (!previous || rank < previous.rank) {
      selected.set(owner, { file, rank })
    }
  }
  const active = new Set([...selected.values()].map(value => value.file))
  return files.filter(file => active.has(file))
}

export function workspaceHmrSidecarExtensions(platform: MpPlatform) {
  return ['ts', 'js', 'vue', 'json', ...getSourceTemplateExtensions(platform)]
}

export function isWorkspaceHmrStylesheetOutput(filename: string) {
  const extension = path.extname(filename).slice(1)
  return getSupportedMiniProgramPlatforms().some(platform => getMiniProgramPlatformDescriptor(platform).outputExtensions.wxss === extension)
}
