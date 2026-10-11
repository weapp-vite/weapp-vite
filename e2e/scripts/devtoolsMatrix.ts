import type { ResolvedWechatDevtoolsTarget, WechatDevtoolsChannel } from 'weapp-ide-cli'
import type { SuiteRuntimeBlocker } from './suiteReport'
import { WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL } from 'weapp-ide-cli'

export interface DevtoolsMatrixRequest {
  devtoolsChannel: WechatDevtoolsChannel
  devtoolsVersion?: string
}

export interface DevtoolsMatrixRun {
  exitCode: number
  unsafeReason?: string
  runtimeBlocker?: SuiteRuntimeBlocker
  incompleteReason?: string
  suiteAcceptance?: 'passed' | 'failed' | 'incomplete'
  coverage?: 'complete' | 'partial'
  runtimeVersions?: Array<{ version: string, baseLibraryVersion: string | null, installationId: string }>
  suiteReport?: string
}

export interface DevtoolsMatrixEntry extends DevtoolsMatrixRun {
  requested: DevtoolsMatrixRequest
  selected?: ResolvedWechatDevtoolsTarget
  status: 'passed' | 'failed' | 'blocked' | 'not-executed'
  reason?: string
  official?: DevtoolsMatrixOfficialQuery
}

export interface DevtoolsMatrixOfficialQuery {
  channel: WechatDevtoolsChannel
  version: string | null
  source: string
  queriedAt: string
  error?: string
}

export function parseDevtoolsMatrixTargets(value = 'stable'): DevtoolsMatrixRequest[] {
  const seen = new Set<string>()
  return value.split(',').map((entry) => {
    const match = /^(stable|rc|nightly)(?:@(\d+(?:\.\d+){2,}))?$/.exec(entry.trim())
    if (!match || seen.has(entry.trim())) {
      throw new Error('Matrix targets must be unique stable, rc, nightly or channel@complete-version values.')
    }
    seen.add(entry.trim())
    return { devtoolsChannel: match[1] as WechatDevtoolsChannel, ...(match[2] ? { devtoolsVersion: match[2] } : {}) }
  })
}

/** 只有普通测试失败允许续行；所有权、清理与取消异常冻结剩余目标。 */
export async function runDevtoolsMatrix(
  requests: DevtoolsMatrixRequest[],
  hooks: {
    resolve: (request: DevtoolsMatrixRequest) => Promise<ResolvedWechatDevtoolsTarget>
    run: (target: ResolvedWechatDevtoolsTarget) => Promise<DevtoolsMatrixRun>
    queryOfficial?: (request: DevtoolsMatrixRequest) => Promise<DevtoolsMatrixOfficialQuery>
  },
  signal?: AbortSignal,
) {
  const entries: DevtoolsMatrixEntry[] = []
  let halted: string | undefined
  for (const requested of requests) {
    if (signal?.aborted) {
      halted = 'Matrix cancelled'
    }
    if (halted) {
      entries.push({ requested, status: 'not-executed', exitCode: 1, reason: halted })
      continue
    }
    let target: ResolvedWechatDevtoolsTarget | undefined
    const official = await hooks.queryOfficial?.(requested).catch((error: unknown) => ({
      channel: requested.devtoolsChannel,
      version: null,
      source: WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL,
      queriedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }))
    try {
      signal?.throwIfAborted()
      target = await hooks.resolve(requested)
      signal?.throwIfAborted()
      const result = await hooks.run(target)
      if (signal?.aborted) {
        result.unsafeReason ??= 'Matrix cancelled'
      }
      if (result.runtimeVersions?.some(value => value.version !== target!.version || value.installationId !== target!.installationId)) {
        result.unsafeReason ??= 'Observed runtime does not belong to the selected DevTools installation/version'
      }
      const observed = result.runtimeVersions?.length && result.runtimeVersions.every(value => value.version === target!.version && value.installationId === target!.installationId && value.baseLibraryVersion)
      const status = result.unsafeReason || result.runtimeBlocker || result.incompleteReason ? 'blocked' : result.exitCode ? 'failed' : observed ? 'passed' : 'blocked'
      entries.push({ ...result, requested, selected: target, official, status, reason: result.unsafeReason ?? result.runtimeBlocker?.reason ?? result.incompleteReason ?? (result.exitCode === 0 && !observed ? 'No complete observed runtime version evidence' : undefined) })
      halted = result.unsafeReason
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      entries.push({ requested, official, ...(target ? { selected: target } : {}), status: 'blocked', exitCode: 1, reason })
      if (target || signal?.aborted || /HOST_IDENTITY_MISMATCH|OWNERSHIP|OOM|Runtime busy|cleanup failed/i.test(reason)) {
        halted = reason
      }
    }
  }
  return { entries, exitCode: entries.length && entries.every(entry => entry.status === 'passed') ? 0 : 1 }
}
