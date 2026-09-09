import path from 'node:path'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import { parse as parseSfc } from 'vue/compiler-sfc'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export type WorkspaceHmrRuntime = 'standard' | 'stateful'

export interface StatefulHmrControl {
  buildId: string
  token: string
  url: string
}

export function resolveWorkspaceHmrRuntime(hasStatefulControl: boolean): WorkspaceHmrRuntime {
  return hasStatefulControl ? 'stateful' : 'standard'
}

export function parseStatefulHmrControlSource(source: string): StatefulHmrControl {
  const serialized = source.match(/=\s*(\{[^\r\n]+\});/)?.[1]
  if (!serialized) {
    throw new Error('Invalid stateful HMR control source.')
  }
  const control = JSON.parse(serialized) as Partial<StatefulHmrControl>
  if (
    typeof control.buildId !== 'string'
    || typeof control.token !== 'string'
    || typeof control.url !== 'string'
  ) {
    throw new TypeError('Incomplete stateful HMR control source.')
  }
  return control as StatefulHmrControl
}

export function resolveHmrScriptOutputPath(
  project: {
    distRoot: string
    hmrRuntime: WorkspaceHmrRuntime
    sourceRoot: string
  },
  sourcePath: string,
) {
  if (project.hmrRuntime === 'stateful') {
    return path.join(project.distRoot, '__weapp_vite_hmr/update.js')
  }
  const relative = path.relative(project.sourceRoot, sourcePath)
  const parsed = path.parse(relative)
  return path.join(project.distRoot, parsed.dir, `${parsed.name}.js`)
}

export function isReactTemplateSource(sourcePath: string) {
  return /(?:^|[/\\])view\.[jt]sx$/.test(sourcePath)
}

export function resolveReactTemplateOutputPath(
  project: {
    distRoot: string
    sourceRoot: string
  },
  sourcePath: string,
) {
  const relative = path.relative(project.sourceRoot, sourcePath)
  return path.join(project.distRoot, path.dirname(relative), 'index.wxml')
}

export function injectReactTemplateMarker(source: string, marker: string) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  let insertionOffset: number | undefined
  traverse(ast, {
    JSXOpeningElement(nodePath) {
      const node = nodePath.node
      if (node.name.type !== 'JSXIdentifier' || !/^(?:[A-Z][\w$]*|view)$/.test(node.name.name)) {
        return
      }
      insertionOffset = node.end! - (node.selfClosing ? 2 : 1)
      nodePath.stop()
    },
  })
  if (insertionOffset === undefined) {
    throw new Error('React HMR audit requires a JSX element to mutate.')
  }
  const escapedMarker = marker.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  return `${source.slice(0, insertionOffset)} data-hmr-marker="${escapedMarker}"${source.slice(insertionOffset)}`
}

/** 修改实际内联样式；只有外链样式时增加独立块，保留外链所有权。 */
export function injectVueStyleRule(source: string, rule: string) {
  const { descriptor, errors } = parseSfc(source)
  if (errors.length > 0) {
    throw new Error('Vue HMR audit requires a valid SFC before mutation.')
  }
  const inlineStyle = descriptor.styles.find(style => !style.src)
  if (!inlineStyle) {
    return `${source.trimEnd()}\n<style>\n${rule}\n</style>\n`
  }
  const offset = inlineStyle.loc.end.offset
  return `${source.slice(0, offset)}\n${rule}\n${source.slice(offset)}`
}

/** 动态 React 模板固定，JSX 更新需要验证实际脚本载荷。 */
export function isDynamicReactTemplate(templateSource: string) {
  return /<template\s[^>]*\bis\s*=\s*['"]react_root['"][^>]*\bdata\s*=/.test(templateSource)
}
