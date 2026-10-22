import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { compilerNativeScriptVersion, observeCompilerInputs } from '../../plugins/utils/sourceSnapshot'
import { readRequestedIdeConfig } from '../classicIdeConfig/reader'

interface StartupChange {
  file?: string
  event?: string
  verifyInitialInput?: boolean
}

const observations = new WeakMap<object, ReturnType<typeof observeInitialBuildInputs>>()

/** 扫描与首构共用实际读取摘要；只剔除已发布版本的迟到更新通知。 */
function observeInitialBuildInputs(owner: object) {
  const latest = new Map<string, string>()
  const unstable = new Set<string>()
  let collecting: Map<string, string> | undefined
  let published: ReadonlyMap<string, string> | undefined
  const release = observeCompilerInputs(owner, (file, source) => {
    const id = compilerSourceId(file)
    const version = compilerNativeScriptVersion(source)
    if (latest.has(id) && latest.get(id) !== version) {
      unstable.add(id)
    }
    latest.set(id, version)
    if (collecting) {
      if (unstable.has(id)) {
        collecting.delete(id)
      }
      else {
        collecting.set(id, version)
      }
    }
  })
  return {
    begin() {
      collecting = new Map([...latest].filter(([file]) => !unstable.has(file)))
    },
    commit() {
      published = collecting
      collecting = undefined
      latest.clear()
      unstable.clear()
      release()
    },
    async filter<T extends StartupChange>(changes: T[]): Promise<T[]> {
      const baseline = published
      if (!baseline?.size) {
        return changes
      }
      const retained: T[] = []
      for (const change of changes) {
        const version = change.verifyInitialInput && change.event === 'update' && change.file
          ? baseline.get(compilerSourceId(change.file))
          : undefined
        let current: string | undefined
        if (version && change.file) {
          try {
            current = compilerNativeScriptVersion(await readRequestedIdeConfig(owner, change.file))
          }
          catch (error) {
            if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) {
              throw error
            }
          }
        }
        if (!version || version !== current) {
          retained.push(change)
        }
      }
      // 第一个真实后续批次开始后不再借用启动版本，源码恢复必须重新发布。
      if (retained.length) {
        published = undefined
      }
      return retained
    },
    close() {
      release()
      latest.clear()
      unstable.clear()
      collecting = published = undefined
    },
  }
}

/** 编译会话拥有观察期，保证预扫描失败和构建尚未开始时也能释放。 */
export function startInitialBuildInputObservation(owner: object): () => void {
  observations.get(owner)?.close()
  const observation = observeInitialBuildInputs(owner)
  observations.set(owner, observation)
  return () => {
    observation.close()
    if (observations.get(owner) === observation) {
      observations.delete(owner)
    }
  }
}

export function getInitialBuildInputObservation(owner: object) {
  return observations.get(owner)
}
