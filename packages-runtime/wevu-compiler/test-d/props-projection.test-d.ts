import type { TemplateCompileOptions, TemplateCompileResult, VueTransformResult } from '@wevu/compiler'
import { compileVueFile, compileVueTemplateToWxml } from '@wevu/compiler'
import { expectType } from 'tsd'

const options = {
  scriptSetupPropConflicts: ['canvasId'] as const,
  scriptSetupBindings: { canvasId: 'setup-ref' },
} satisfies TemplateCompileOptions

expectType<TemplateCompileResult>(compileVueTemplateToWxml('<canvas :canvas-id="canvasId" />', 'src/canvas.vue', options))

const compilation = compileVueFile('<template><view /></template>', 'src/page.vue', {
  sfcSrc: {
    resolveId: async (_source, _importer) => undefined,
    readFile: async _id => 'export const props = Object.freeze({ title: String })',
  },
})
expectType<Promise<VueTransformResult>>(compilation)
compilation.then(result => expectType<string[] | undefined>(result.meta?.propsAnalysisDeps))
