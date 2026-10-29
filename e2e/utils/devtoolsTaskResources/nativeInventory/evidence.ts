import type { DarwinProcessIdentity } from '../processInventory/darwinInspector/types'
import type { NativeImageEvidence, NativeProcessFrameEvidence } from '../types'
import type { metadata, NativeFrame } from './model'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { insideInstallation } from './model'

/** 报告保留映像等价性和安装内相对路径，不扩大披露其他应用或临时目录。 */
export function imageEvidence(image: string, installationRoot: string): NativeImageEvidence {
  const sha256 = createHash('sha256').update(image).digest('hex')
  return insideInstallation(installationRoot, image)
    ? { sha256, scope: 'installation', installationRelativePath: path.relative(installationRoot, image).replaceAll('\\', '/') }
    : { sha256, scope: 'outside-installation' }
}

/** 仅公开身份和核验结果，明确剥离 UID 及未来可能增加的原始结构字段。 */
function identityEvidence(identity: DarwinProcessIdentity | null) {
  return identity && {
    pid: identity.pid,
    parentPid: identity.parentPid,
    started: `${identity.startedSeconds}.${identity.startedMicroseconds.padStart(6, '0')}`,
    zombie: identity.zombie,
    startedSeconds: identity.startedSeconds,
    startedMicroseconds: identity.startedMicroseconds,
    status: identity.status,
  }
}

export function nativeFrameEvidence(frame: NativeFrame, installationRoot: string): NativeProcessFrameEvidence {
  return {
    phase: frame.phase,
    requestId: frame.wire.requestId,
    startedAtNanoseconds: frame.wire.startedAtNanoseconds,
    endedAtNanoseconds: frame.wire.endedAtNanoseconds,
    enumeratedPidCount: frame.wire.enumeration.pidCount,
    ownedHelper: { identity: identityEvidence(frame.wire.ownedHelper.identity)!, image: imageEvidence(frame.wire.ownedHelper.executable, installationRoot) },
    rows: [...frame.rows.values()].map(({ entry }) => ({
      pid: entry.pid,
      before: identityEvidence(entry.before.identity),
      after: identityEvidence(entry.after.identity),
      beforeQuery: { result: entry.before.result, length: entry.before.length, errno: entry.before.errno },
      afterQuery: { result: entry.after.result, length: entry.after.length, errno: entry.after.errno },
      interval: { startedAtNanoseconds: entry.startedAtNanoseconds, endedAtNanoseconds: entry.endedAtNanoseconds },
      pathBefore: { count: entry.pathBefore.count, errno: entry.pathBefore.errno, image: entry.pathBefore.executable === null ? null : imageEvidence(entry.pathBefore.executable, installationRoot) },
      pathAfter: { count: entry.pathAfter.count, errno: entry.pathAfter.errno, image: entry.pathAfter.executable === null ? null : imageEvidence(entry.pathAfter.executable, installationRoot) },
      rss: { count: entry.task.count, errno: entry.task.errno, identity: identityEvidence(entry.task.identity), bytes: entry.task.rssBytes },
      gaps: [...entry.gaps],
    })),
  }
}

export function textReadEvidence(read: { row: Parameters<typeof metadata>[0], images: string[] | null, startedAt: string, endedAt: string, failure?: string }, installationRoot: string) {
  return { images: read.images?.map(image => imageEvidence(image, installationRoot)) ?? null, startedAtNanoseconds: read.startedAt, endedAtNanoseconds: read.endedAt, ...(read.failure ? { failure: read.failure } : {}) }
}
