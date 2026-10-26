import type { startDevProcess } from '../dev-process'
import type { NativePublicationOptions, NativePublicationReceipt, NativePublicationSourceEvidence } from './files'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizedSource } from '../devBuildCompletion/nativeIdentity'
import {
  isNativePublicationProfileIdentity,
  NATIVE_PUBLICATION_PREFIX,
  nativePublicationGeneration,
  nativePublicationHash,
  readNativePublicationInputs,
} from './files'

function isFingerprint(value: unknown): value is Record<string, string> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).length && Object.entries(value).every(([file, hash]) => file && typeof hash === 'string' && /^[a-f\d]{64}$/.test(hash)))
}

interface NativePublicationObservation extends NativePublicationReceipt {
  outputOffset: number
  sourcePublications?: NativePublicationSourceEvidence[]
}

interface NativePublicationCaptureOptions extends NativePublicationOptions {
  /** 仅由调用方以本次完整冷构建完成边界证明来源 END 可省略。 */
  allowSourceFreePublication?: (outputOffset: number) => boolean
}

function receipts(output: string): NativePublicationObservation[] {
  let outputOffset = 0
  return output.slice(0, output.lastIndexOf('\n') + 1).split('\n').flatMap((line) => {
    outputOffset += line.length + 1
    const start = line.indexOf(NATIVE_PUBLICATION_PREFIX)
    if (start < 0) {
      return []
    }
    const value: unknown = JSON.parse(line.slice(start + NATIVE_PUBLICATION_PREFIX.length))
    if (!value || typeof value !== 'object' || !('boundary' in value) || (value.boundary !== 'native-byte-write' && value.boundary !== 'native-noop')
      || !('generation' in value) || typeof value.generation !== 'string'
      || !('inputs' in value) || !isFingerprint(value.inputs) || !('outputs' in value) || !isFingerprint(value.outputs)
      || value.generation !== nativePublicationGeneration(value.outputs)) {
      throw new Error('Invalid native publication receipt')
    }
    if ('outputScope' in value && value.outputScope !== 'committed-root') {
      throw new Error('Invalid native publication output scope')
    }
    if ((value.boundary === 'native-noop' || 'outputScope' in value)
      && (!('publicationEpoch' in value) || !Number.isSafeInteger(value.publicationEpoch) || Number(value.publicationEpoch) < 0)) {
      throw new Error('Invalid native no-op publication epoch')
    }
    if ('profileCursor' in value) {
      const cursor = value.profileCursor
      if (!cursor || typeof cursor !== 'object' || !('offset' in cursor) || !Number.isSafeInteger(cursor.offset) || Number(cursor.offset) < 0
        || !('prefixHash' in cursor) || typeof cursor.prefixHash !== 'string' || !/^[a-f\d]{64}$/.test(cursor.prefixHash)) {
        throw new Error('Invalid native publication profile cursor')
      }
      if ('identity' in cursor && !isNativePublicationProfileIdentity(cursor.identity)) {
        throw new Error('Invalid native publication profile identity')
      }
    }
    return [{ ...value as NativePublicationReceipt, outputOffset }]
  })
}

/** 编辑前捕获游标，只核对最终输入和实际字节；正式构建成功、未发射文件及所有权须另验。 */
export function captureNativePublication(
  dev: Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>,
  project: string,
  options: NativePublicationCaptureOptions = {},
) {
  const offset = dev.getOutput().length
  const outputRoot = path.resolve(project, options.outputRoot ?? 'dist')
  const expectedSources = new Set(options.expectedSourceFiles?.map(normalizedSource))
  return {
    async wait(timeoutMs = 30_000) {
      const reads = new AbortController()
      const completed = Promise.withResolvers<NativePublicationObservation>()
      let active = true
      let checking = false
      const inputs = await readNativePublicationInputs(project, options, reads.signal)
      const generation = nativePublicationGeneration(inputs)
      let diagnostics: unknown = { expectedInputGeneration: generation, receipt: null }
      const check = async () => {
        if (!active || checking) {
          return
        }
        checking = true
        try {
          const output = dev.getOutput().slice(offset)
          if (/Build failed|classic HMR 切换失败|classic 回退失败/.test(output)) {
            throw new Error('Native publication failed; preserve the original dev build error')
          }
          const candidates: NativePublicationObservation[] = []
          const sourcePublications: NativePublicationSourceEvidence[] = []
          const observedSources = new Set<string>()
          const publications = receipts(output).reverse()
          const matching = publications.filter(receipt => nativePublicationGeneration(receipt.inputs) === generation)
          // 增量收据保留未覆盖产物；完整提交视图明确退役旧文件，仍要求磁盘证明删除。
          const finalOutputs: Record<string, string | null> = {}
          for (const receipt of [...matching].reverse()) {
            if (receipt.outputScope === 'committed-root') {
              for (const file of Object.keys(finalOutputs)) {
                if (!(file in receipt.outputs)) {
                  finalOutputs[file] = null
                }
              }
            }
            Object.assign(finalOutputs, receipt.outputs)
          }
          const files = await Promise.all(Object.entries(matching.length ? finalOutputs : publications[0]?.outputs ?? {}).map(async ([file, expected]) => {
            try {
              return { file, expected, actual: nativePublicationHash(await readFile(path.join(outputRoot, file), { signal: reads.signal })) }
            }
            catch (error) {
              const code = (error as NodeJS.ErrnoException).code ?? 'unknown'
              if (code !== 'ENOENT' && matching.length) {
                throw error
              }
              return { file, expected, error: code }
            }
          }))
          const latest = publications[0]
          if (latest) {
            diagnostics = {
              expectedInputGeneration: generation,
              receipt: { boundary: latest.boundary, generation: latest.generation, inputGeneration: nativePublicationGeneration(latest.inputs), identity: latest.profileCursor?.identity },
              inputDifferences: [...new Set([...Object.keys(inputs), ...Object.keys(latest.inputs)])].sort().filter(file => inputs[file] !== latest.inputs[file]).map(file => ({ file, expected: inputs[file], actual: latest.inputs[file] })),
              outputs: files,
            }
          }
          if (!matching.length || !files.every(file => file.expected === null ? 'error' in file && file.error === 'ENOENT' : 'actual' in file && file.actual === file.expected)) {
            return
          }
          for (const receipt of matching) {
            const sources = new Set(receipt.profileCursor?.identity?.sourceEvents.map(event => normalizedSource(event.file)))
            const identity = receipt.profileCursor?.identity
            const matchingFiles = [...expectedSources].filter(file => sources.has(file))
            const outputOffset = offset + receipt.outputOffset
            if (!expectedSources.size || matchingFiles.length || options.allowSourceFreePublication?.(outputOffset)) {
              candidates.push({ ...receipt, outputOffset })
            }
            if (identity && receipt.profileCursor && matchingFiles.length) {
              sourcePublications.unshift({ cursor: { ...receipt.profileCursor, identity }, files: matchingFiles })
              for (const file of matchingFiles) {
                observedSources.add(file)
              }
            }
          }
          diagnostics = { ...diagnostics as object, missingSources: [...expectedSources].filter(file => !observedSources.has(file)) }
          // 同一最终输入可被多个真实通知批次消费；每个来源保留自身的原生写出和 END 游标。
          const covered = observedSources.size === expectedSources.size
          const receipt = candidates.find(candidate => covered || options.allowSourceFreePublication?.(candidate.outputOffset))
          if (receipt) {
            if (nativePublicationGeneration(await readNativePublicationInputs(project, options, reads.signal)) !== generation) {
              throw new Error('Native publication input changed while awaiting the final write')
            }
            if (active) {
              completed.resolve({ ...receipt, ...(covered && expectedSources.size ? { sourcePublications } : {}) })
            }
          }
        }
        catch (error) {
          if (active) {
            completed.reject(error)
          }
        }
        finally {
          checking = false
        }
      }
      const interval = setInterval(() => {
        void check()
      }, 25)
      const deadline = setTimeout(() => {
        completed.reject(new Error(`Timed out: final source generation must reach the native root write boundary\nNative publication diagnostics: ${JSON.stringify(diagnostics)}`))
      }, timeoutMs)
      try {
        void check()
        return await dev.waitFor(completed.promise, 'native publication receipt')
      }
      finally {
        active = false
        reads.abort()
        clearInterval(interval)
        clearTimeout(deadline)
      }
    },
  }
}
