import type { CompilerContext } from '../../../../context'
import type { ResolvedAppShell } from '../appShell'
import type { VueBundleCompileOptionsState } from '../bundle/shared'
import { WEVU_APP_SHELL_VIRTUAL_PREFIX } from '@weapp-core/constants'
import { compileVueFile } from 'wevu/compiler'
import { extractConfigFromVue } from '../../../../utils/file/vueConfig'
import { resolveCompilerOutputExtensions } from '../../../../utils/outputExtensions'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { resolveSfcTemplateSource } from '../../../utils/sfcTemplateDependencies'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { createCompileVueFileOptions } from '../compileOptions'
import { applyComponentResolutionDependencies, getVueCompilationDependencies } from '../componentResolutionDependencies'
import { readVueLikeCompilerInput } from '../sourceInput'
import { usesNativeSlotOwnerRuntime } from './options'

export interface AppShellRuntimeModule {
  id: string
  sourceId: string
  fileName: string
  code: string
  dependencies: string[]
}

/** 仅编译外壳的组件脚本；原 App 继续拥有模板、样式及其 scoped ID。 */
export async function compileAppShellRuntime(options: {
  ctx: CompilerContext
  pluginCtx: any
  appShell: ResolvedAppShell | undefined
  compileOptionsState: VueBundleCompileOptionsState
}): Promise<AppShellRuntimeModule | undefined> {
  const { ctx, pluginCtx, appShell, compileOptionsState } = options
  const { configService, scanService } = ctx
  if (!appShell || !usesNativeSlotOwnerRuntime(configService)) {
    return undefined
  }
  const app = await scanService.loadAppEntry()
  const sourceId = normalizeFsResolvedId(app.path)
  const { source } = await readVueLikeCompilerInput(configService, sourceId)
  const readOptions = createReadAndParseSfcOptions(pluginCtx, configService, { source })
  const { descriptor } = await readAndParseSfc(sourceId, readOptions)
  if (!descriptor.template?.content.trim()) {
    return undefined
  }
  const appConfig = await extractConfigFromVue(sourceId, { compilerContext: ctx, source })
  const componentConfig = Object.fromEntries(['usingComponents', 'componentGenerics']
    .filter(key => appConfig?.[key] !== undefined)
    .map(key => [key, appConfig![key]]))
  const language = descriptor.template.lang ? ` lang=${JSON.stringify(descriptor.template.lang)}` : ''
  const shellSource = `<template${language}>${descriptor.template.content}</template>\n<json>${JSON.stringify(componentConfig)}</json>`
  const filename = `${appShell.file}.vue`
  const compileOptions = createCompileVueFileOptions(ctx, pluginCtx, filename, false, false, configService, compileOptionsState)
  const result = await compileVueFile(shellSource, filename, {
    ...compileOptions,
    skipComponentTransform: false,
    sourceMap: false,
  })
  applyComponentResolutionDependencies(result, compileOptions, filename)
  if (!result.script?.trim()) {
    throw new Error('应用外壳的原生插槽上下文缺少组件脚本。')
  }
  const { scriptExtension } = resolveCompilerOutputExtensions(configService.outputExtensions)
  const templateDependency = resolveSfcTemplateSource(readOptions.resolveSrc, descriptor.template.src, sourceId)
  return {
    id: `${WEVU_APP_SHELL_VIRTUAL_PREFIX}${sourceId}`,
    sourceId,
    fileName: `${configService.relativeOutputPath(appShell.file)}.${scriptExtension}`,
    code: result.script,
    dependencies: [...new Set([sourceId, ...getVueCompilationDependencies(result), ...(templateDependency ? [templateDependency] : [])])],
  }
}
