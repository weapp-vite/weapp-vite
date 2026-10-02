import type { VueCompilerOptions } from '@vue/language-core'
import { CompilerOptionsResolver, getDefaultCompilerOptions } from '@vue/language-core'
import ts from 'typescript'
import plugin from '../src/index'

export function createTestVueCompilerOptions(lib = 'vue', skipTemplateCodegen = false): VueCompilerOptions {
  const defaults = getDefaultCompilerOptions(3.5, lib, false)
  const resolver = new CompilerOptionsResolver(ts, ts.sys.readFile)
  resolver.plugins = [plugin]

  return resolver.build({
    ...defaults,
    skipTemplateCodegen,
    resolveStyleClassNames: false,
    fallthroughComponentNames: [],
    dataAttributes: [],
    htmlAttributes: [],
    optionsWrapper: [],
    composables: {
      ...defaults.composables,
      useTemplateRef: ['useTemplateRef'],
    },
    experimentalModelPropName: {},
  })
}
