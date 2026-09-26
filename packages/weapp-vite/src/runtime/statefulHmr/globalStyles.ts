import type { GlassEaselAnalysisFact } from '../../analyze/glassEasel/types'
import type { StatefulHmrOutputFile } from './outputWriter'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import path from 'pathe'
import { changeFileExtension } from '../../utils/file'
import { createStatefulHmrStyleRebaser } from './globalStyles/rebase'

export interface StatefulHmrSnapshot {
  output: StatefulHmrOutputFile[]
  componentPageGlobalStyleRoutes: string[]
  glassEaselAnalysisByOwner: ReadonlyMap<string, GlassEaselAnalysisFact>
  entryIds?: string[]
  delegatedComponentEntryIds?: string[]
}

function normalizeRoute(route: string): string {
  return path.posix.normalize(route.replace(/\\/g, '/').replace(/^\/+/, ''))
}

const globalStart = `/* ${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}:start */\n`
const globalEnd = `\n/* ${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}:end */\n`
const pageStyleRefreshMarkerPrefix = '.weapp-vite-stateful-hmr-style-'

function pageStyleRefreshMarker(token: string) {
  return `${pageStyleRefreshMarkerPrefix}${token} { --weapp-vite-stateful-hmr-style-token: ${token}; }\n`
}

function stripPageStyleRefreshMarker(source: string) {
  const markerStart = source.lastIndexOf(pageStyleRefreshMarkerPrefix)
  if (markerStart < 0 || !source.endsWith(' }\n')) {
    return source
  }
  const markerEnd = source.indexOf(' {', markerStart)
  if (markerEnd < 0) {
    return source
  }
  const token = source.slice(markerStart + pageStyleRefreshMarkerPrefix.length, markerEnd)
  return /^[a-f0-9]+$/.test(token) ? source.slice(0, markerStart).replace(/\n$/, '') : source
}

function styleRefreshToken(source: string | Uint8Array) {
  return createHash('sha256').update(source).digest('hex').slice(0, 16)
}

function localStyleSource(source: string): string {
  if (!source.startsWith(globalStart)) {
    return source
  }
  const end = source.indexOf(globalEnd, globalStart.length)
  if (end < 0) {
    throw new Error('Stateful HMR component page global stylesheet boundary is incomplete')
  }
  return source.slice(end + globalEnd.length)
}

/** 将全局样式放在同目录资产，避免微信直接修改 app.wxss 时完整重启。 */
export function createStatefulHmrGlobalStyleAssets(
  output: StatefulHmrOutputFile[],
  styleExtension: string,
  options: {
    createIfMissing?: boolean
    componentPageGlobalStyleRoutes?: Iterable<string>
    previousComponentPageGlobalStyleRoutes?: Iterable<string>
    refreshPageStyles?: boolean
  } = {},
): StatefulHmrOutputFile[] {
  const entryFile = changeFileExtension('app', styleExtension)
  const styleFile = changeFileExtension(WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME, styleExtension)
  const entry = output.find(item => item.type === 'asset' && item.fileName === entryFile)
  if (!entry && !options.createIfMissing) {
    return output
  }
  const entrySource = `@import "./${styleFile}";\n`
  const existingStyle = output.find(item => item.fileName === styleFile)
  if (existingStyle) {
    if (entry?.type !== 'asset' || Buffer.from(entry.source).toString('utf8') !== entrySource) {
      throw new Error(`Stateful HMR global stylesheet conflicts with emitted asset: ${styleFile}`)
    }
  }
  else {
    const styleSource = entry?.type === 'asset' ? entry.source : ''
    output = [
      ...output.filter(item => item !== entry),
      { type: 'asset', fileName: entryFile, source: entrySource },
      { type: 'asset', fileName: styleFile, source: styleSource },
    ]
  }
  const routes = new Set(Array.from(options.componentPageGlobalStyleRoutes ?? [], normalizeRoute))
  const previousRoutes = Array.from(options.previousComponentPageGlobalStyleRoutes ?? [], normalizeRoute)
  const sources = new Map(output.flatMap(item => item.type === 'asset' && path.extname(item.fileName) === path.extname(styleFile)
    ? [[item.fileName, localStyleSource(Buffer.from(item.source).toString('utf8'))] as const]
    : []))
  const rebase = createStatefulHmrStyleRebaser(sources)
  let result = output
  for (const route of new Set([...routes, ...previousRoutes])) {
    const fileName = `${route}${path.extname(styleFile)}`
    const index = result.findIndex(item => item.fileName === fileName)
    const asset = result[index]
    if (asset && asset.type !== 'asset') {
      throw new Error(`Stateful HMR component page stylesheet conflicts with emitted chunk: ${fileName}`)
    }
    const original = asset ? stripPageStyleRefreshMarker(Buffer.from(asset.source).toString('utf8')) : ''
    const localSource = localStyleSource(original)
    const source = routes.has(route) ? globalStart + rebase(styleFile, fileName) + globalEnd + localSource : localSource
    if (asset && original === source) {
      continue
    }
    // 退出 apply-shared 且没有自有样式的页面仍由 Vite emit 空资产，清除磁盘上的旧全局快照。
    if (result === output) {
      result = [...output]
    }
    const next: StatefulHmrOutputFile = { type: 'asset', fileName, source }
    if (index >= 0) {
      result[index] = next
    }
    else {
      result.push(next)
    }
  }
  if (!options.refreshPageStyles) {
    return result
  }

  const globalStyle = result.find(item => item.type === 'asset' && item.fileName === styleFile)
  const token = styleRefreshToken(globalStyle?.type === 'asset' ? globalStyle.source : '')
  const marker = pageStyleRefreshMarker(token)
  for (const [index, item] of result.entries()) {
    if (item.type !== 'asset' || path.extname(item.fileName) !== path.extname(styleFile)
      || !routes.has(item.fileName.slice(0, -path.extname(styleFile).length))) {
      continue
    }
    // 布局组件的无关 WXSS 刷新会破坏宿主中的 slot 样式更新，只刷新继承全局样式的页面。
    const original = Buffer.from(item.source).toString('utf8')
    const source = stripPageStyleRefreshMarker(original)
    // 已移除的全局样式页通过空资产清理旧文件，不能追加标记重新生成非空样式。
    if (!source) {
      continue
    }
    const nextSource = `${source}${source && !source.endsWith('\n') ? '\n' : ''}${marker}`
    if (original === nextSource) {
      continue
    }
    if (result === output) {
      result = [...output]
    }
    result[index] = { ...item, source: nextSource }
  }
  return result
}
