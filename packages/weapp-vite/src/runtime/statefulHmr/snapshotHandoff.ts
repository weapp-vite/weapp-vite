import type { CompilerContext } from '../../context'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { SnapshotInputs } from './snapshotInputs'
import { setHostRestartData, takeHostRestartData } from '../../vite/lifecycle'
import { getStatefulHmrHost } from './hostPlugins'
import { validateSnapshotInputs } from './snapshotInputs'

const snapshotKey = Symbol('weapp-vite:stateful-snapshot-handoff')
type SnapshotOwner = Pick<CompilerContext, 'runtimeState'>
const standalone = new WeakMap<SnapshotOwner, StatefulHmrSnapshotHandoff>()

/** 只交接已经编译成功的值；所有权转移和输入失效都不可逆，避免重复发布。 */
export class StatefulHmrSnapshotHandoff {
  private snapshot?: StatefulHmrSnapshot
  private revision = 0

  constructor(snapshot: StatefulHmrSnapshot, private readonly inputs?: SnapshotInputs, private readonly validate = validateSnapshotInputs) {
    this.snapshot = snapshot
  }

  invalidate() {
    this.revision++
    this.snapshot = undefined
  }

  async take() {
    const snapshot = this.snapshot
    const revision = this.revision
    this.snapshot = undefined
    if (!snapshot || !this.inputs || !await this.validate(this.inputs) || revision !== this.revision) {
      return undefined
    }
    return snapshot
  }
}

export function offerStatefulHmrSnapshot(ctx: SnapshotOwner, handoff: StatefulHmrSnapshotHandoff) {
  const host = getStatefulHmrHost(ctx)
  if (host) {
    setHostRestartData(host.server, snapshotKey, handoff)
  }
  else {
    standalone.set(ctx, handoff)
  }
}

export function takeStatefulHmrSnapshot(ctx: SnapshotOwner) {
  const host = getStatefulHmrHost(ctx)
  if (host) {
    return takeHostRestartData<StatefulHmrSnapshotHandoff>(host.server, snapshotKey)?.take()
  }
  const handoff = standalone.get(ctx)
  standalone.delete(ctx)
  return handoff?.take()
}

export function clearStatefulHmrSnapshot(ctx: SnapshotOwner) {
  standalone.get(ctx)?.invalidate()
  standalone.delete(ctx)
}
