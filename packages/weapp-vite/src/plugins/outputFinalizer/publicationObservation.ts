import type { EmittedAsset, OutputBundle } from 'rolldown'
import type { createPublicAssetPublication } from '../asset/publication'
import { Buffer } from 'node:buffer'

export interface NativeOutputPublicationSnapshot {
  readonly epoch: number
  readonly root: string
  readonly outputs: ReadonlyMap<string, string | Uint8Array>
}

export interface NativeOutputPublicationApi {
  getEpoch: () => number
  /** 显式观察本代最终字节；不把只读代次查询变成缓存分配。 */
  captureEpoch: () => number
  readCommitted: (root: string, epoch: number) => NativeOutputPublicationSnapshot | undefined
  whenCommitted: (root: string, epoch: number) => Promise<NativeOutputPublicationSnapshot | undefined>
}

interface PendingOutputPublication {
  epoch: number
  ownership?: () => Promise<void>
  generation?: () => unknown
  sources?: Map<string, string>
  outputNames: string[]
  partial: boolean
  observedAssets: EmittedAsset[]
}

export interface OutputPublicationScope {
  publicAssets?: ReturnType<typeof createPublicAssetPublication>
  cache: Map<string, string> | undefined
  pending?: PendingOutputPublication
  observation: ReturnType<typeof createNativePublicationObservation>
}

/** 返回隔离的只读视图，不向观察者暴露编译器缓存或可变资产来源。 */
function readonlyOutputs(outputs: Map<string, string | Uint8Array>): ReadonlyMap<string, string | Uint8Array> {
  const view: ReadonlyMap<string, string | Uint8Array> = Object.freeze({
    get size() { return outputs.size },
    get: (file: string) => outputs.get(file),
    has: (file: string) => outputs.has(file),
    entries: () => outputs.entries(),
    keys: () => outputs.keys(),
    values: () => outputs.values(),
    [Symbol.iterator]: () => outputs[Symbol.iterator](),
    forEach(callback: (source: string | Uint8Array, file: string, map: ReadonlyMap<string, string | Uint8Array>) => void, thisArg?: unknown) {
      outputs.forEach((source, file) => callback.call(thisArg, source, file, view))
    },
  })
  return view
}

/** 复用已提交字节缓存；仅有观察请求时才复制完整视图，不增加发布热路径的全量指纹。 */
export function createNativePublicationObservation(root: string, cache: Map<string, string> | undefined) {
  let completedEpoch: number | undefined
  let hasNativeWrite = false
  const binary = new Set<string>()
  let additional = new Map<string, string | Uint8Array>()
  let observed: Map<string, string | Uint8Array> | undefined
  const waiting = new Map<number, ReturnType<typeof Promise.withResolvers<NativeOutputPublicationSnapshot | undefined>>>()

  function readCommitted(epoch: number): NativeOutputPublicationSnapshot | undefined {
    if (!hasNativeWrite || completedEpoch !== epoch) {
      return undefined
    }
    const outputs = new Map<string, string | Uint8Array>()
    if (observed) {
      for (const [file, source] of observed) {
        outputs.set(file, typeof source === 'string' ? source : Uint8Array.from(source))
      }
    }
    else {
      for (const [file, source] of cache ?? []) {
        if (typeof source === 'string') {
          outputs.set(file, binary.has(file) ? Buffer.from(source, 'base64') : source)
        }
      }
      for (const [file, source] of additional) {
        outputs.set(file, typeof source === 'string' ? source : Uint8Array.from(source))
      }
    }
    return outputs.size ? Object.freeze({ epoch, root, outputs: readonlyOutputs(outputs) }) : undefined
  }

  function invalidate() {
    completedEpoch = undefined
    observed = undefined
    for (const request of waiting.values()) {
      request.resolve(undefined)
    }
    waiting.clear()
  }

  return {
    readCommitted,
    whenCommitted(epoch: number) {
      if (completedEpoch === epoch) {
        return Promise.resolve(readCommitted(epoch))
      }
      let request = waiting.get(epoch)
      if (!request) {
        request = Promise.withResolvers<NativeOutputPublicationSnapshot | undefined>()
        waiting.set(epoch, request)
      }
      return request.promise
    },
    commit(epoch: number, bundle: OutputBundle, assets: Iterable<EmittedAsset>, captureBytes = false) {
      observed = undefined
      for (const file of binary) {
        if (!cache?.has(file)) {
          binary.delete(file)
        }
      }
      for (const [file, output] of Object.entries(bundle)) {
        if (typeof cache?.get(file) !== 'string') {
          continue
        }
        if (output.type === 'asset' && typeof output.source !== 'string') {
          binary.add(file)
        }
        else {
          binary.delete(file)
        }
      }
      additional = new Map()
      for (const asset of assets) {
        if (asset.fileName && asset.source !== undefined) {
          additional.set(asset.fileName, asset.source)
        }
      }
      hasNativeWrite ||= Object.keys(bundle).length > 0
      completedEpoch = epoch
      const request = waiting.get(epoch)
      if (request || captureBytes) {
        // 生产模式没有开发裁剪缓存；仅有本轮观察请求时复制最终字节，不保留 chunk 或 AST。
        observed = new Map(readCommitted(epoch)?.outputs)
        for (const [file, output] of Object.entries(bundle)) {
          const source = output.type === 'chunk' ? output.code : output.source
          observed.set(file, typeof source === 'string' ? source : Uint8Array.from(source))
        }
      }
      if (request) {
        waiting.delete(epoch)
        request.resolve(readCommitted(epoch))
      }
    },
    invalidate,
    reset() {
      invalidate()
      hasNativeWrite = false
      binary.clear()
      additional.clear()
    },
  }
}
