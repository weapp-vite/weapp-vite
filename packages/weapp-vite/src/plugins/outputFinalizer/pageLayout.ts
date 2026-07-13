import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { ResolvedPageLayoutPlan } from '../vue/transform/pageLayout'
import { Buffer } from 'node:buffer'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'
import { resolveRelativeOutputFileNameWithExtension } from '../utils/outputFileName'
import { applyPageLayoutPlanToNativePage } from '../vue/transform/pageLayout'

interface NativePageLayoutOutput {
  pageId: string
  plan: ResolvedPageLayoutPlan
}

const nativePageLayoutOutputs = new WeakMap<object, Map<string, NativePageLayoutOutput>>()

export function registerNativePageLayoutOutput(options: {
  configService: CompilerContext['configService']
  runtimeState: CompilerContext['runtimeState']
  pageId: string
  templatePath: string
  plan?: ResolvedPageLayoutPlan
}) {
  const { configService, runtimeState, pageId, templatePath, plan } = options
  const { templateExtension } = resolveCompilerOutputExtensions(configService.outputExtensions)
  const fileName = resolveRelativeOutputFileNameWithExtension(
    configService,
    templatePath,
    templateExtension,
  )
  const outputs = nativePageLayoutOutputs.get(runtimeState) ?? new Map<string, NativePageLayoutOutput>()

  if (plan) {
    outputs.set(fileName, { pageId, plan })
    nativePageLayoutOutputs.set(runtimeState, outputs)
  }
  else {
    outputs.delete(fileName)
  }
}

export function restoreNativePageLayoutOutputs(
  ctx: CompilerContext,
  bundle: OutputBundle,
) {
  const outputs = nativePageLayoutOutputs.get(ctx.runtimeState)
  if (!outputs?.size) {
    return
  }

  for (const [fileName, { pageId, plan }] of outputs) {
    const output = bundle[fileName]
    if (output?.type !== 'asset') {
      continue
    }

    const source = typeof output.source === 'string'
      ? output.source
      : Buffer.from(output.source).toString('utf8')
    const transformed = applyPageLayoutPlanToNativePage(
      { template: source },
      pageId,
      plan,
      { platform: ctx.configService.platform },
    )

    if (transformed.template) {
      output.source = transformed.template
    }
  }
}
