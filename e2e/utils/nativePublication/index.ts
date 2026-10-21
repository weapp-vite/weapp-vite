import type { startDevProcess } from '../dev-process'
import type { NativePublicationOptions, NativePublicationReceipt } from './files'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
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
    if (!value || typeof value !== 'object' || !('boundary' in value) || value.boundary !== 'native-byte-write'
      || !('generation' in value) || typeof value.generation !== 'string'
      || !('inputs' in value) || !isFingerprint(value.inputs) || !('outputs' in value) || !isFingerprint(value.outputs)
      || value.generation !== nativePublicationGeneration(value.outputs)) {
      throw new Error('Invalid native publication receipt')
    }
    if ('profileCursor' in value) {
      const cursor = value.profileCursor
      if (!cursor || typeof cursor !== 'object' || !('offset' in cursor) || !Number.isSafeInteger(cursor.offset) || Number(cursor.offset) < 0
        || !('prefixHash' in cursor) || typeof cursor.prefixHash !== 'string' || !/^[a-f\d]{64}$/.test(cursor.prefixHash)) {
        throw new Error('Invalid native publication profile cursor')
      }
    }
    return [{ ...value as NativePublicationReceipt, outputOffset }]
  })
}

/** 编辑前捕获游标，只核对最终输入和实际字节；正式构建成功、未发射文件及所有权须另验。 */
export function captureNativePublication(
  dev: Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>,
  project: string,
  options: NativePublicationOptions = {},
) {
  const offset = dev.getOutput().length
  return {
    async wait(timeoutMs = 30_000) {
      const reads = new AbortController()
      const completed = Promise.withResolvers<NativePublicationObservation>()
      let active = true
      let checking = false
      const inputs = await readNativePublicationInputs(project, options, reads.signal)
      const generation = nativePublicationGeneration(inputs)
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
          for (const receipt of receipts(output).reverse()) {
            if (nativePublicationGeneration(receipt.inputs) !== generation) {
              continue
            }
            try {
              const matches = await Promise.all(Object.entries(receipt.outputs).map(async ([file, hash]) => nativePublicationHash(await readFile(path.join(project, 'dist', file), { signal: reads.signal })) === hash))
              if (matches.every(Boolean)) {
                if (nativePublicationGeneration(await readNativePublicationInputs(project, options, reads.signal)) !== generation) {
                  throw new Error('Native publication input changed while awaiting the final write')
                }
                if (active) {
                  completed.resolve({ ...receipt, outputOffset: offset + receipt.outputOffset })
                }
                return
              }
            }
            catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error
              }
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
        completed.reject(new Error('Timed out: final source generation must reach the native root write boundary'))
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
