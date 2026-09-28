import type { HmrCompilerPreparation } from '@weapp-vite/hmr'
import type { Compiler, CompilerCssTransformOptions, CompilerSnapshot } from 'weapp-tailwindcss/core'
import { createTailwindPreparation } from './controller'

export interface TailwindOutputInput {
  id: string
  target?: CompilerSnapshot['target']
  css: string
  classSet: Iterable<string>
  dependencies?: Iterable<string>
  styleOptions?: CompilerCssTransformOptions
}

export interface TailwindOutput {
  css: string
  snapshot: CompilerSnapshot
  preparation: HmrCompilerPreparation
}

/** 在宿主回调内封存投影，再异步转换；Vite 最终 CSS 和所有补丁共用同一身份集合。 */
export function prepareTailwindOutput(compiler: Compiler | Promise<Compiler>, input: TailwindOutputInput): Promise<TailwindOutput> {
  const css = input.css
  const snapshotInput = {
    id: input.id,
    classSet: new Set(input.classSet),
    dependencies: input.dependencies ? [...input.dependencies] : [],
    target: input.target ?? 'weapp',
  }
  const styleOptions = input.styleOptions ? { ...input.styleOptions } : undefined
  return Promise.resolve(compiler).then(async (instance) => {
    const snapshot = instance.createSnapshot(snapshotInput)
    const result = await instance.transformCss(css, snapshot, styleOptions)
    return { css: result.css, snapshot, preparation: createTailwindPreparation(instance, snapshot) }
  })
}
