import type { ComponentPropMap } from '../componentProps'
import { compileScript, parse } from 'vue/compiler-sfc'
import { extractComponentProps } from '../componentProps'
import { extractInlinePropsTypeFromCode } from './dtsProps'

/** 提取 Vue SFC 组件 props，避免为了类型支持文件走完整 SFC 编译。 */
export function extractVueComponentProps(source: string, filename: string, options: {
  astEngine?: 'babel' | 'oxc'
} = {}): ComponentPropMap {
  const inlineProps = extractInlinePropsTypeFromCode(source)
  if (inlineProps.size > 0) {
    return inlineProps
  }

  const { descriptor, errors } = parse(source, { filename })
  if (errors.length || (!descriptor.script && !descriptor.scriptSetup)) {
    return new Map()
  }

  const compiled = compileScript(descriptor, {
    id: filename,
    isProd: false,
  })
  if (!compiled.content) {
    return new Map()
  }

  return extractComponentProps(compiled.content, {
    astEngine: options.astEngine,
  })
}
