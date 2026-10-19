import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { WeappCompilerHmrPreparation } from '../../types/compilerPlugin'
import type { ImportedTailwindGeneration } from './importedGeneration'
import { CompilerHmrResyncError } from '../compilerPlugin/hmr'
import { takeImportedGeneration } from './importedGeneration'

type Validate = (files?: Iterable<string>, consumed?: Iterable<string>) => void | Promise<void>
interface ImportedPreparation {
  validate: Validate
  sources?: ReadonlyMap<string, string | null>
  generation?: ImportedTailwindGeneration
}
interface ImportedBuild {
  preparations: readonly ImportedPreparation[]
  consumed: Set<number | string>
  rejection?: CompilerHmrResyncError
}

const validations = new WeakMap<WeappCompilerHmrPreparation, ImportedPreparation>()
const builds = new WeakMap<ReadonlyMap<string, string | null>, ImportedBuild>()

/** 导入式 CSS 仍由原生 Vite 管线生成，preparation 只交接冻结编译语义与生命周期。 */
export function rememberImportedTailwindPreparation(preparation: WeappCompilerHmrPreparation, validate: Validate, sources?: ReadonlyMap<string, string | null>, generation?: ImportedTailwindGeneration) {
  const imported = { validate, sources, generation }
  validations.set(preparation, imported)
  const dispose = preparation.dispose
  let disposal: Promise<void> | undefined
  preparation.dispose = () => {
    if (!disposal) {
      imported.validate = () => {
        throw new CompilerHmrResyncError([], 'Tailwind imported preparation is disposed')
      }
      disposal = Promise.resolve().then(() => dispose?.())
    }
    return disposal
  }
}

export function requiresImportedTailwindSnapshot(preparations: readonly WeappCompilerHmrPreparation[]) {
  return preparations.some(preparation => validations.has(preparation))
}

/** 快照编译前后都核对同一 root generation 与磁盘依赖版本。 */
async function validateImportedTailwindPreparations(preparations: readonly ImportedPreparation[]) {
  for (const preparation of preparations) {
    await preparation.validate()
  }
}

/** 导入式 CSS 沿用原生快照管线，拒绝准备与重建之间发生的输入漂移。 */
export async function withImportedTailwindSnapshot<T>(preparations: readonly WeappCompilerHmrPreparation[], rebuild: () => Promise<T>, sources?: ReadonlyMap<string, string | null>): Promise<T> {
  const imported = preparations.flatMap(preparation => validations.has(preparation) ? [validations.get(preparation)!] : [])
  const views = [...new Set(imported.flatMap(preparation => preparation.sources ? [preparation.sources] : []))]
  if (views.some(view => builds.has(view) || (sources && sources !== view))) {
    throw new CompilerHmrResyncError([], 'Tailwind imported snapshot has another input or build owner')
  }
  const binding: ImportedBuild = { preparations: imported, consumed: new Set() }
  for (const view of views) {
    builds.set(view, binding)
  }
  try {
    await validateImportedTailwindPreparations(imported)
    const result = await rebuild()
    await validateImportedTailwindPreparations(imported)
    if (imported.some(preparation => [...preparation.generation?.roots.keys() ?? []].some(key => !binding.consumed.has(key)))) {
      throw new CompilerHmrResyncError([], 'Tailwind imported snapshot did not consume every frozen root')
    }
    return result
  }
  catch (error) {
    const wrapped = error && typeof error === 'object' && 'errors' in error ? error.errors : undefined
    if (binding.rejection && Array.isArray(wrapped) && wrapped.length === 1 && wrapped[0] === binding.rejection) {
      throw binding.rejection
    }
    throw error
  }
  finally {
    for (const view of views) {
      builds.delete(view)
    }
  }
}

/** 原生构建实际消费的来源即使随后被删除，也必须属于冻结输入。 */
export async function validateImportedTailwindSnapshot(sources: ReadonlyMap<string, string | null> | undefined, files: Iterable<string>, consumed: Iterable<string>) {
  const binding = sources && builds.get(sources)
  try {
    for (const preparation of binding?.preparations ?? []) {
      await preparation.validate(files, consumed)
    }
  }
  catch (error) {
    if (binding && error instanceof CompilerHmrResyncError) {
      binding.rejection = error
    }
    throw error
  }
}

/** 在原生 CSS 转换前交接冻结结果，快照不再次扫描磁盘候选。 */
export async function takeImportedTailwindGeneration(sources: ReadonlyMap<string, string | null> | undefined, key: number | string, request: CompilerGenerateRequest, options: unknown) {
  const binding = sources && builds.get(sources)
  if (!binding) {
    return undefined
  }
  try {
    if (binding.preparations.length !== 1) {
      throw new CompilerHmrResyncError([], 'Tailwind imported snapshot has multiple generation owners')
    }
    await validateImportedTailwindSnapshot(sources, [], [])
    const entry = await takeImportedGeneration(binding.preparations[0]!.generation, key, request, sources!, options)
    await validateImportedTailwindSnapshot(sources, [], [])
    binding.consumed.add(key)
    return entry
  }
  catch (error) {
    if (error instanceof CompilerHmrResyncError) {
      binding.rejection = error
    }
    throw error
  }
}
