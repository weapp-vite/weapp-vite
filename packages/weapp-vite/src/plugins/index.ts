import type { Plugin } from 'vite'
import type { CompilerContext } from '@/context'
import type { SubPackageMetaValue, WeappVitePluginApi } from '@/types'
import { wrapPlugin } from 'vite-plugin-performance'
import { resolveWeappAutoRoutesConfig } from '@/autoRoutesConfig'
import { createSelectedRuntimeProviderPlugin, resolveRuntimeProvider } from '@/runtimeProviders'
import { createAppBuilderPlugin } from '../runtime/buildPlugin/appBuilder'
import { asset } from './asset'
import { autoImport } from './autoImport'
import { autoRoutes } from './autoRoutes'
import { createCompilerPluginPlugins } from './compilerPlugin'
import { weappVite } from './core'
import { css } from './css'
import { i18n } from './i18n'
import { createLibDtsPlugin } from './libDts'
import { createOutputFinalizerPlugin, createOutputPublicationPlugin } from './outputFinalizer'
import { markOwnedPlugin } from './ownedInstances'
import { createPackageImportsQueryPlugin } from './packageImports'
import { createPluginProjectOutputPlugin } from './pluginProjectOutput'
import { preflight } from './preflight'
import { createProjectConfigDirectoryPlugin } from './projectConfig/directory'
import { createReactPlugin, isReactEnabled } from './react'
import { createTailwindcssPlugin } from './tailwindcss'
import { uniAppCompatibility } from './uniApp'
import { vue } from './vue'
import { createWasmPlugin, resolveWasmScope } from './wasm'
import { wevu } from './wevu'
import { createWorkerOutputPlugin } from './workerOutput'
import { workers } from './workers'
import { wxs } from './wxs'

const RUNTIME_PLUGINS_SYMBOL = Symbol.for('weapp-runtime:plugins')
export const WEAPP_VITE_CONTEXT_PLUGIN_NAME = 'weapp-vite:context'

function createContextPlugin(ctx: CompilerContext): Plugin<WeappVitePluginApi> {
  return {
    name: WEAPP_VITE_CONTEXT_PLUGIN_NAME,
    enforce: 'pre',
    api: {
      ctx,
    },
  }
}

function attachRuntimePlugins(ctx: CompilerContext, plugins: Plugin[]): Plugin[] {
  const runtimePlugins = (ctx as any)[RUNTIME_PLUGINS_SYMBOL] as Plugin[] | undefined
  if (!runtimePlugins?.length) {
    return plugins
  }

  return [...runtimePlugins, ...plugins]
}

function applyInspect(ctx: CompilerContext, plugins: Plugin[]): Plugin[] {
  const inspectOptions = ctx.configService.weappViteConfig?.debug?.inspect
  if (!inspectOptions) {
    return plugins
  }

  // @ts-ignore 第三方类型未暴露 Plugin[] 的重载
  return wrapPlugin(plugins, inspectOptions)
}

function flatten(groups: Plugin[][]): Plugin[] {
  return groups.reduce<Plugin[]>((acc, cur) => {
    acc.push(...cur)
    return acc
  }, [])
}

function markInternalPlugins(plugins: Plugin[]): Plugin[] {
  for (const plugin of plugins) {
    // 这里只处理内部工厂产物；第三方适配器仍保留原对象和元数据广播语义。
    if (plugin.name.startsWith('weapp-vite:') || plugin.name.startsWith('weapp-runtime:')) {
      markOwnedPlugin(plugin)
    }
  }
  return plugins
}

function hasWevuDependency(ctx: CompilerContext) {
  const packageJson = ctx.configService?.packageJson
  return Boolean(packageJson?.dependencies?.wevu || packageJson?.devDependencies?.wevu)
}

export function vitePluginWeapp(
  ctx: CompilerContext,
  subPackageMeta?: SubPackageMetaValue,
): Plugin<WeappVitePluginApi>[] {
  const libModeEnabled = ctx.configService?.weappLibConfig?.enabled
  const vueEnabled = ctx.configService?.weappViteConfig?.vue?.enable !== false
  const reactEnabled = isReactEnabled(ctx)
  const vueRuntimeEnabled = vueEnabled && (!reactEnabled || hasWevuDependency(ctx))
  const runtimeProvider = resolveRuntimeProvider('miniprogram', vueRuntimeEnabled ? 'vue' : 'native')
  const groups: Plugin[][] = [
    [createContextPlugin(ctx), createPackageImportsQueryPlugin(), createSelectedRuntimeProviderPlugin(runtimeProvider, ctx.configService.isDev)],
    [createWasmPlugin(ctx, resolveWasmScope(ctx, subPackageMeta?.subPackage.independent ? subPackageMeta.subPackage.root : undefined))],
    preflight(ctx),
    uniAppCompatibility(ctx),
    createReactPlugin(ctx),
    vue(ctx, { enable: vueEnabled, react: reactEnabled }),
  ]
  if (vueEnabled && !libModeEnabled && !reactEnabled) {
    groups.push(wevu(ctx))
  }
  const autoRoutesEnabled = resolveWeappAutoRoutesConfig(ctx.configService?.weappViteConfig?.autoRoutes).enabled

  if (!subPackageMeta) {
    groups.push(asset(ctx))
    if (autoRoutesEnabled && !libModeEnabled) {
      groups.push(autoRoutes(ctx))
    }
    groups.push(autoImport(ctx))
  }

  const compilerPlugins = createCompilerPluginPlugins(ctx)
  const tailwindcssPlugins = createTailwindcssPlugin(ctx)
  groups.push(i18n(ctx, subPackageMeta), weappVite(ctx, subPackageMeta), wxs(ctx))
  if (compilerPlugins.length > 0) {
    groups.push([compilerPlugins[0]!])
  }
  if (tailwindcssPlugins.length > 0) {
    groups.push([tailwindcssPlugins[0]!])
  }
  groups.push(css(ctx))
  if (!subPackageMeta && !libModeEnabled) {
    groups.push([createProjectConfigDirectoryPlugin(ctx), createAppBuilderPlugin(ctx), createWorkerOutputPlugin(ctx), createPluginProjectOutputPlugin(ctx)])
  }
  groups.push([createOutputFinalizerPlugin(ctx, subPackageMeta)])
  if (tailwindcssPlugins.length > 1) {
    groups.push([tailwindcssPlugins[1]!])
  }
  if (compilerPlugins.length > 1) {
    groups.push([compilerPlugins[1]!])
  }

  if (!subPackageMeta && libModeEnabled) {
    groups.push([createLibDtsPlugin(ctx)])
  }
  groups.push([createOutputPublicationPlugin(ctx, subPackageMeta)])

  const assembled = attachRuntimePlugins(ctx, flatten(groups))
  if (subPackageMeta) {
    return markInternalPlugins(assembled)
  }

  return markInternalPlugins(applyInspect(ctx, assembled))
}

export function vitePluginWeappWorkers(ctx: CompilerContext): Plugin<WeappVitePluginApi>[] {
  const groups = [[createContextPlugin(ctx), createPackageImportsQueryPlugin(), createWasmPlugin(ctx, resolveWasmScope(ctx, undefined, true))], preflight(ctx), workers(ctx)]
  const assembled = attachRuntimePlugins(ctx, flatten(groups))
  return markInternalPlugins(applyInspect(ctx, assembled))
}
