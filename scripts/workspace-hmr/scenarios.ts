import path from 'node:path'

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
  return source.replace(
    /<(?:[A-Z][\w$]*|view)\b[^>]*>/,
    tag => tag.endsWith('/>')
      ? `${tag.slice(0, -2)} data-hmr-marker="${marker}" />`
      : `${tag.slice(0, -1)} data-hmr-marker="${marker}">`,
  )
}
