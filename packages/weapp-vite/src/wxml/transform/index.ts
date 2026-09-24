import type { CompilerContext } from '../../context'
import type { WxmlTransformContext } from '../../types'
import type { WxmlSyntax } from '../template/lexical'
import path from 'pathe'
import { editWxml } from './editor'

export async function transformWxml(
  ctx: CompilerContext,
  code: string,
  fileName: string,
  syntax: WxmlSyntax,
  addWatchFile: (file: string) => void,
  warn: (message: string) => void,
  subPackageRoot?: string,
): Promise<string> {
  const config = ctx.configService
  const wxml = config?.weappViteConfig?.wxml
  const transform = typeof wxml === 'object' ? wxml.transform : undefined
  if (!transform) {
    return code
  }
  const transforms = Array.isArray(transform) ? transform : [transform]
  const name = path.normalize(fileName)
  for (const [index, callback] of transforms.entries()) {
    let active = true
    const assertActive = () => {
      if (!active) {
        throw new Error('The template transform callback has already completed.')
      }
    }
    const context: WxmlTransformContext = Object.freeze<WxmlTransformContext>({
      fileName: name,
      root: config.cwd,
      platform: config.platform ?? 'weapp',
      mode: config.mode,
      isDev: config.isDev,
      subPackageRoot,
      edit(source, visitor) {
        assertActive()
        return editWxml(source, name, syntax, visitor)
      },
      addWatchFile(file) {
        assertActive()
        addWatchFile(file)
      },
      warn(message) { warn(`[weapp.wxml.transform] ${name} (callback ${index + 1}): ${message}`) },
      error(message): never { throw new Error(message) },
    })
    try {
      if (typeof callback !== 'function') {
        throw new TypeError('Expected a transform function.')
      }
      const result = await callback(code, context)
      if (result !== null && result !== undefined) {
        if (typeof result !== 'string') {
          throw new TypeError('Expected a string, null, or undefined transform result.')
        }
        code = result
      }
    }
    catch (cause) {
      throw new Error(`[weapp.wxml.transform] ${name} (callback ${index + 1}): ${cause instanceof Error ? cause.message : String(cause)}`, { cause })
    }
    finally {
      active = false
    }
  }
  return code
}
