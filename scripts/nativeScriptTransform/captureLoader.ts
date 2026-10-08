import { createHash } from 'node:crypto'
import { registerHooks } from 'node:module'

export interface CaptureLoadIdentity {
  target: string
  loadCount: number
  upstreamSha256?: string
  instrumentedSha256?: string
}

/** 在目标 resolve 时后注册 load，包住稍晚安装且 shortCircuit 的既有源码 owner。 */
export function installCaptureLoader(targetUrl: string, target: string, instrument: (source: string) => string) {
  const identity: CaptureLoadIdentity = { target, loadCount: 0 }
  let late: ReturnType<typeof registerHooks> | undefined
  let disposed = false
  const observer = registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context)
      if (!disposed && resolved.url === targetUrl && !late) {
        late = registerHooks({
          load(url, loadContext, nextLoad) {
            const loaded = nextLoad(url, loadContext)
            if (url !== targetUrl) {
              return loaded
            }
            identity.loadCount++
            if (identity.loadCount !== 1 || loaded.format !== 'module' || typeof loaded.source !== 'string') {
              throw new Error('Capture requires exactly one textual module load from the existing owner')
            }
            identity.upstreamSha256 = createHash('sha256').update(loaded.source).digest('hex')
            const source = instrument(loaded.source)
            identity.instrumentedSha256 = createHash('sha256').update(source).digest('hex')
            return { ...loaded, source }
          },
        })
      }
      return resolved
    },
  })
  return {
    snapshot: (): CaptureLoadIdentity => ({ ...identity }),
    assertInstalled() {
      if (disposed || identity.loadCount !== 1 || !identity.instrumentedSha256) {
        throw new Error('Capture requires a fresh process and exactly one instrumented transformScript module')
      }
    },
    dispose() {
      if (!disposed) {
        disposed = true
        late?.deregister()
        observer.deregister()
      }
    },
  }
}
