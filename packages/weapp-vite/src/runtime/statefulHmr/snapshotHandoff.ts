import type { CompilerContext } from '../../context'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrProfileHandoff } from './profile'
import type { SnapshotInputs } from './snapshotInputs'
import { readFile } from 'node:fs/promises'
import { setHostRestartData, takeHostRestartData } from '../../vite/lifecycle'
import { getStatefulHmrHost } from './hostPlugins'
import { validateSnapshotInputs } from './snapshotInputs'

const snapshotKey = Symbol('weapp-vite:stateful-snapshot-handoff')
type SnapshotOwner = Pick<CompilerContext, 'runtimeState'>
const standalone = new WeakMap<SnapshotOwner, StatefulHmrSnapshotHandoff>()

async function validateProfileSources(sources: ReadonlyMap<string, string | null>) {
  return (await Promise.all([...sources].map(async ([file, source]) => {
    const current = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return null
      }
      throw error
    })
    return current === source
  }))).every(Boolean)
}

/** 只交接已经编译成功的值；所有权转移和输入失效都不可逆，避免重复发布。 */
export class StatefulHmrSnapshotHandoff {
  private snapshot?: StatefulHmrSnapshot
  private revision = 0

  constructor(snapshot: StatefulHmrSnapshot, private readonly inputs?: SnapshotInputs, private readonly validate = validateSnapshotInputs, private profile?: StatefulHmrProfileHandoff, private readonly sources?: ReadonlyMap<string, string | null>) {
    this.snapshot = snapshot
  }

  async invalidate(status: 'incomplete' | 'failed' = 'incomplete') {
    this.revision++
    this.snapshot = undefined
    const profile = this.profile
    this.profile = undefined
    await profile?.cancel(status)
  }

  async take() {
    const snapshot = this.snapshot
    const revision = this.revision
    this.snapshot = undefined
    if (!snapshot) {
      return undefined
    }
    try {
      let valid = this.inputs ? await this.validate(this.inputs) : false
      if (!this.inputs && this.profile) {
        const files = this.profile.sourceFiles()
        if (files.length && files.every(file => this.sources?.has(file))) {
          // compiler sources 也可含虚拟模块；仅校验原始事件对应的真实源文件。
          const sources = new Map(files.map(file => [file, this.sources!.get(file)!]))
          const validate = () => validateProfileSources(sources)
          this.profile.validateWith(validate)
          try {
            valid = await validate()
          }
          catch {
            // 诊断读取失败不能阻止替换会话重新编译。
            await this.invalidate('failed')
            return undefined
          }
        }
      }
      if (!valid || revision !== this.revision) {
        await this.invalidate()
        return undefined
      }
      const profile = this.profile
      this.profile = undefined
      // 不可复用快照仍可触发一次新构建；原事件计时由替换会话接续到完整发布。
      return this.inputs || profile ? { snapshot: this.inputs ? snapshot : undefined, profile } : undefined
    }
    catch (error) {
      await this.invalidate('failed')
      throw error
    }
  }
}

export async function offerStatefulHmrSnapshot(ctx: SnapshotOwner, handoff: StatefulHmrSnapshotHandoff) {
  const host = getStatefulHmrHost(ctx)
  if (host) {
    await setHostRestartData(host.server, snapshotKey, handoff, status => handoff.invalidate(status))
  }
  else {
    const previous = standalone.get(ctx)
    standalone.set(ctx, handoff)
    await previous?.invalidate()
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

export async function clearStatefulHmrSnapshot(ctx: SnapshotOwner) {
  const handoff = standalone.get(ctx)
  standalone.delete(ctx)
  await handoff?.invalidate()
}
