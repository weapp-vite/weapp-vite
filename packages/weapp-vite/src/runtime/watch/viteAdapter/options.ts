import type { ChokidarOptions } from 'chokidar'
import type { Stats } from 'node:fs'
import type { ResolvedConfig, ViteDevServer } from 'vite'
import nodePath from 'node:path'
import process from 'node:process'
import path from 'pathe'
import picomatch from 'picomatch'
import { resolvePollingWatchOptions } from '../options'

type WatchOptions = ViteDevServer['watcher']['options']

export function usesNativeViteWatcher(requested: Exclude<ResolvedConfig['server']['watch'], null>) {
  const envPolling = process.env.CHOKIDAR_USEPOLLING?.toLowerCase()
  const polling = envPolling !== undefined ? envPolling !== 'false' && envPolling !== '0' && envPolling !== '' : requested?.usePolling === true
  return requested?.followSymlinks === false || requested?.disableGlobbing === false || (requested?.useFsEvents === true && !polling)
}

function unixPath(file: string) {
  const normalized = file.replaceAll('\\', '/')
  return `${normalized.startsWith('//') ? '/' : ''}${normalized.replace(/\/{2,}/g, '/')}`
}

/** Chokidar 3 先规范字符串规则；带 cwd 的负向文本也先按相对路径拼接。 */
function normalizeIgnoredPattern(pattern: string, cwd = '') {
  return unixPath(nodePath.normalize(unixPath(nodePath.isAbsolute(pattern) ? pattern : nodePath.join(cwd, pattern))))
}

/** 输入已无转义反斜杠，保持 is-glob 严格模式对问号、括号和空花括号的判定。 */
function isIgnoredGlob(pattern: string) {
  if (pattern.startsWith('!') || /[@?!+*]\(.*\)/.test(pattern)) {
    return true
  }
  for (let index = 0; index < pattern.length; index++) {
    const token = pattern[index]!
    if (token === '*' || (pattern[index + 1] === '?' && /[\].+)]/.test(token))) {
      return true
    }
    if ((token === '[' && pattern[index + 1] !== ']' && pattern.indexOf(']', index) > index)
      || (token === '{' && pattern[index + 1] !== '}' && pattern.indexOf('}', index) > index)) {
      return true
    }
    if (token === '(') {
      if (pattern[index + 1] === '?' && /[:!=]/.test(pattern[index + 2] ?? '') && pattern[index + 3] !== ')' && pattern.indexOf(')', index) > index) {
        return true
      }
      const pipe = pattern.indexOf('|', index)
      if (pattern[index + 1] !== '|' && pipe !== -1 && pattern[pipe + 1] !== ')' && pattern.indexOf(')', pipe) > pipe) {
        return true
      }
    }
  }
  return false
}

/** anymatch 只统一分隔符，不解析用户回调和正则收到的点路径或相对路径。 */
function normalizeMatchPath(file: string) {
  const extended = file.length > 4 && file[3] === '\\' && (file[2] === '?' || file[2] === '.') && file.startsWith('\\\\')
  return `${extended ? '//' : ''}${(extended ? file.slice(2) : file).split(/[/\\]+/).join('/')}`
}

/** 按 Vite 内置 Chokidar 3 的规范顺序保留 anymatch 与字面路径后代语义。 */
export function compileIgnored(ignored: WatchOptions['ignored'], cwd?: string) {
  const normalized = (ignored === undefined ? [] : Array.isArray(ignored) ? ignored : [ignored])
    .map(pattern => typeof pattern === 'string' ? normalizeIgnoredPattern(pattern, cwd) : pattern)
  const patterns = [...normalized, ...normalized.filter((pattern): pattern is string => typeof pattern === 'string' && !isIgnoredGlob(pattern)).map(pattern => `${pattern}/**`)]
  const negatives = patterns.filter((pattern): pattern is string => typeof pattern === 'string' && pattern.startsWith('!'))
    .map(pattern => picomatch(pattern.slice(1), { dot: true }))
  const positives = patterns.filter(pattern => typeof pattern !== 'string' || !pattern.startsWith('!')).map<(file: string, stats?: Stats) => boolean>((pattern) => {
    if (typeof pattern === 'function') {
      return pattern
    }
    if (pattern instanceof RegExp) {
      return file => pattern.test(file)
    }
    const match = picomatch(pattern, { dot: true })
    return file => pattern === file || match(file)
  })
  return (file: string, stats?: Stats) => {
    const normalized = normalizeMatchPath(file)
    return !negatives.some(match => match(normalized)) && positives.some(match => match(normalized, stats))
  }
}

export function resolveViteAdapterOptions(defaults: WatchOptions, requested: Exclude<ResolvedConfig['server']['watch'], null>): { options: WatchOptions, backend: ChokidarOptions } {
  const ignored = [
    ...(defaults.ignored === undefined ? [] : Array.isArray(defaults.ignored) ? defaults.ignored : [defaults.ignored]),
    ...(requested?.ignored === undefined ? [] : Array.isArray(requested.ignored) ? requested.ignored : [requested.ignored]),
  ]
  const options = { ...defaults, ...requested, ignored }
  const polling = resolvePollingWatchOptions({ inlineConfig: { server: { watch: options } } })
  const backend: ChokidarOptions = {
    persistent: false,
    ignoreInitial: options.ignoreInitial,
    followSymlinks: options.followSymlinks,
    cwd: options.cwd,
    ignored: compileIgnored(ignored, options.cwd),
    ...polling,
    alwaysStat: options.alwaysStat,
    depth: options.depth,
    ignorePermissionErrors: options.ignorePermissionErrors,
    atomic: options.atomic,
    awaitWriteFinish: options.awaitWriteFinish,
  }
  return { options, backend }
}

export function collectViteAdapterTargets(config: ResolvedConfig) {
  const envDir = config.envDir
  return [...new Set([
    ...config.experimental.bundledDev ? [] : [config.root],
    ...config.configFileDependencies,
    ...envDir === false
      ? []
      : ['.env', '.env.local', `.env.${config.mode}`, `.env.${config.mode}.local`]
          .map(file => path.join(envDir, file)),
    ...config.publicDir ? [config.publicDir] : [],
  ])]
}
