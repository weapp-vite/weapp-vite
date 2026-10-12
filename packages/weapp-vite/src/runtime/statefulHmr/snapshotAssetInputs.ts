import { lstatSync } from 'node:fs'
import { CompilerHmrResyncError, compilerSourceId, getCompilerRawSnapshot } from '../../plugins/compilerPlugin/hmr'
import { compilerRawFileVersion } from '../../plugins/compilerPlugin/rawInputs'
import { captureGenerationDependencies } from '../../plugins/tailwindcss/generation/inputs'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 已知 raw 资产只做版本准入；实际加载、emit 和持久化仍归 Vite。 */
export function createSnapshotAssetInputs(sources?: ReadonlyMap<string, string | null>) {
  const raw = sources && getCompilerRawSnapshot(sources)
  const validations = new Map<string, () => void>()
  const bindingValidations = new Map<string, () => void>()
  let assetsInclude: ((id: string) => boolean) | undefined
  let rejection: CompilerHmrResyncError | undefined
  const guard = (file: string, run: () => void) => {
    try {
      run()
    }
    catch (cause) {
      rejection = new CompilerHmrResyncError([...new Set([...(raw?.changedFiles ?? []), file])], 'Raw snapshot asset changed outside its frozen input')
      Object.defineProperty(rejection, 'cause', { value: cause, configurable: true })
      throw rejection
    }
  }
  const validateBinding = (file: string, target: string) => {
    if (compilerSourceId(file) !== target) {
      throw new Error('Raw snapshot asset alias no longer resolves to its frozen source')
    }
    for (const [link, version] of raw?.bindings.get(normalizeFsResolvedId(file))?.links ?? []) {
      if (compilerRawFileVersion(lstatSync(link, { bigint: true })) !== version) {
        throw new Error('Raw snapshot asset alias changed outside its frozen input')
      }
    }
  }
  const capture = (file: string, assetQuery = false) => {
    if (!assetQuery && !assetsInclude?.(file)) {
      return
    }
    const lexical = normalizeFsResolvedId(file)
    const id = raw?.bindings.get(lexical)?.target ?? (raw?.files.has(lexical) ? lexical : compilerSourceId(file))
    if (!raw?.files.has(id) || validations.has(lexical)) {
      return
    }
    guard(file, () => {
      validateBinding(file, id)
      if (typeof sources!.get(id) !== 'string') {
        throw new TypeError('Raw snapshot asset is absent from its frozen input')
      }
      // 实际 raw reader 的摘要验证二进制字节，纯文本账本只接纳可精确恢复的 UTF-8。
      const validate = captureGenerationDependencies([file], sources!, raw.changedFiles, raw.reads)
      validations.set(lexical, () => {
        validateBinding(file, id)
        validate()
      })
    })
  }
  return {
    configure(classify: (id: string) => boolean) {
      assetsInclude = classify
      for (const [file, binding] of raw?.bindings ?? []) {
        // 未消费的旧 tombstone 不阻断刷新；真正加载它时仍由 capture 明确拒绝。
        if (typeof sources!.get(binding.target) === 'string') {
          // 已登记 alias 在 resolve 得到新的 physical id 前就核对，不能依赖新 id 的集合命中。
          // query 资产可使用任意后缀；只提前核对已观察路径的身份，字节准入仍在实际 load。
          // 原 canonical 目录也可能被 junction 替换，不能等 Vite 产生新 physical id 后才核验。
          const validate = () => validateBinding(file, binding.target)
          guard(file, validate)
          bindingValidations.set(file, validate)
        }
      }
    },
    capture,
    validate() {
      for (const [file, validate] of bindingValidations) {
        guard(file, validate)
      }
      for (const [file, validate] of validations) {
        guard(file, validate)
      }
    },
    restoreError(error: unknown): unknown {
      // 只还原本准入 owner 被 Rolldown 包装的单一拒绝，不覆盖其它构建错误。
      const errors = error && typeof error === 'object' && 'errors' in error ? error.errors : undefined
      return rejection && Array.isArray(errors) && errors.length === 1 && errors[0] === rejection ? rejection : error
    },
  }
}
