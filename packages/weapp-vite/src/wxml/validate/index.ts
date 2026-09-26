import type { OutputBundle } from 'rolldown'
import type { CompilerContext } from '../../context'
import type { WxmlElementInfo, WxmlValidationContext } from '../../types'
import type { WxmlSyntax } from '../template/lexical'
import { Buffer } from 'node:buffer'
import path from 'pathe'
import { beginWxmlDependencies } from '../processing/dependencies'
import { createValidationDiagnostics } from './diagnostics'
import { createValidationNodes } from './walk'

const TEMPLATE_ASSET_RE = /\.(?:wxml|axml|swan|ttml|jxml|qml|ksml|xhsml)$/i

/** 校验所属构建的最终模板，成功返回依赖提交操作供发布阶段执行。 */
export async function validateWxmlBundle(
  ctx: CompilerContext,
  bundle: OutputBundle,
  hooks: { warn: (message: string) => void, addWatchFile: (file: string) => void, partial: boolean },
  subPackageRoot?: string,
) {
  const config = ctx.configService
  const wxml = config?.weappViteConfig?.wxml
  const validate = typeof wxml === 'object' ? wxml.validate : undefined
  const callbacks = validate === undefined ? [] : Array.isArray(validate) ? validate : [validate]
  const state = ctx.runtimeState?.wxmlProcessing
  const hasPrevious = state && ([...state.dependencies.keys()].some(key => key.startsWith('validate:'))
    || [...state.failed.keys()].some(key => key.startsWith('validate:'))
    || [...state.pending.values()].some(build => build.stage === 'validate'))
  if (!callbacks.length && !hasPrevious) {
    return
  }
  const scope = subPackageRoot ? `independent:${subPackageRoot}` : 'main'
  const dependencies = beginWxmlDependencies(ctx, scope, hooks.partial, 'validate')
  const diagnostics = createValidationDiagnostics(hooks.warn)
  const syntax: WxmlSyntax = (config.platform ?? 'weapp') === 'weapp' ? 'legacy' : 'xml'
  try {
    for (const [key, output] of Object.entries(bundle)) {
      if (output.type !== 'asset' || !TEMPLATE_ASSET_RE.test(output.fileName || key)) {
        continue
      }
      const fileName = path.normalize(output.fileName || key)
      const code = typeof output.source === 'string' ? output.source : Buffer.from(output.source).toString('utf8')
      const register = dependencies.template(fileName)
      let nodes: readonly WxmlElementInfo[] | undefined
      for (const [index, callback] of callbacks.entries()) {
        let active = true
        const assertActive = () => {
          if (!active) {
            throw new Error('The template validation callback has already completed.')
          }
        }
        const context: WxmlValidationContext = Object.freeze<WxmlValidationContext>({
          fileName,
          root: config.cwd,
          platform: config.platform ?? 'weapp',
          mode: config.mode,
          isDev: config.isDev,
          subPackageRoot,
          addWatchFile(file) {
            assertActive()
            hooks.addWatchFile(register(file))
          },
          report(diagnostic) {
            assertActive()
            diagnostics.report(fileName, index + 1, diagnostic)
          },
          async walk(visitor) {
            assertActive()
            if (typeof visitor !== 'function') {
              throw new TypeError('walk expects a visitor function.')
            }
            nodes ??= createValidationNodes(code, fileName, syntax)
            for (const node of nodes) {
              assertActive()
              await visitor(node)
            }
          },
        })
        try {
          if (typeof callback !== 'function') {
            throw new TypeError('Expected a validation function.')
          }
          const result = await callback(code, context)
          if (result !== undefined) {
            throw new TypeError('Expected an undefined validation result; use transform to change template source.')
          }
        }
        catch (cause) {
          throw new Error(`[weapp.wxml.validate] ${fileName} (callback ${index + 1}): ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
        }
        finally {
          active = false
        }
      }
    }
    diagnostics.finish()
  }
  catch (error) {
    dependencies.fail()
    throw error
  }
  return dependencies.publish
}
