import type { WechatDevtoolsMetadata } from './metadata'
import type { WechatDevtoolsProfileOptions } from './profile'

export type WechatDevtoolsChannel = 'stable' | 'rc' | 'nightly'

export interface ResolvedWechatDevtoolsTarget extends WechatDevtoolsMetadata {
  cliPath: string
  installationId: string
  appPath: string
  profileDir: string
}

export interface WechatDevtoolsSelectionOptions {
  cliPath?: string
  target?: ResolvedWechatDevtoolsTarget
  devtoolsChannel?: WechatDevtoolsChannel
  devtoolsVersion?: string
  requireOfficialLatest?: boolean
}

export interface ResolveWechatDevtoolsTargetOptions extends WechatDevtoolsProfileOptions, WechatDevtoolsSelectionOptions {
  searchRoots?: string[]
  registryPath?: string
}

export interface WechatDevtoolsInstallation {
  cliPath: string
  target?: ResolvedWechatDevtoolsTarget
  error?: string
}
