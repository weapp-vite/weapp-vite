import type { TemplateCompileOptions, TemplateCompileResult } from '@wevu/compiler'
import { compileVueTemplateToWxml } from '@wevu/compiler'
import { expectType } from 'tsd'

const options = {
  scriptSetupPropConflicts: ['canvasId'] as const,
  scriptSetupBindings: { canvasId: 'setup-ref' },
} satisfies TemplateCompileOptions

expectType<TemplateCompileResult>(compileVueTemplateToWxml('<canvas :canvas-id="canvasId" />', 'src/canvas.vue', options))
