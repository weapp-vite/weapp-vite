import path from 'pathe'

export const DEFAULT_ENTRY_URL = 'https://developers.weixin.qq.com/miniprogram/dev/framework/'
export const DEFAULT_OUTPUT_DIR = path.resolve(import.meta.dirname, '../../docs/wechat-miniprogram/framework')
export const FRAMEWORK_HOST = 'developers.weixin.qq.com'
export const FRAMEWORK_PATH_PREFIX = '/miniprogram/dev/framework/'
const HTML_SUFFIX_RE = /\.html$/

function stripSearchAndHash(url: URL) {
  url.search = ''
  url.hash = ''
  return url
}

function hasInvalidPlaceholderSegment(pathname: string) {
  return pathname.split('/').some(segment => segment.startsWith('('))
}

export function normalizeFrameworkPageUrl(input: string, baseUrl = DEFAULT_ENTRY_URL) {
  if (!input || input.startsWith('javascript:')) {
    return null
  }

  const url = stripSearchAndHash(new URL(input, baseUrl))

  if (url.hostname !== FRAMEWORK_HOST) {
    return null
  }

  if (!url.pathname.startsWith(FRAMEWORK_PATH_PREFIX)) {
    return null
  }

  if (hasInvalidPlaceholderSegment(url.pathname)) {
    return null
  }

  return url.toString()
}

function trimFrameworkPrefix(pathname: string) {
  return pathname.slice(FRAMEWORK_PATH_PREFIX.length)
}

export function toMirrorRelativePath(pageUrl: string) {
  const url = new URL(pageUrl)
  const relativePath = trimFrameworkPrefix(url.pathname)

  if (!relativePath) {
    return 'README.md'
  }

  if (relativePath.endsWith('/')) {
    return path.join(relativePath, 'README.md')
  }

  if (relativePath.endsWith('.html')) {
    return relativePath.replace(HTML_SUFFIX_RE, '.md')
  }

  return path.join(relativePath, 'README.md')
}

export function toAbsoluteSourceUrl(input: string, baseUrl: string) {
  return new URL(input, baseUrl).toString()
}

export function toRelativeMarkdownHref(params: {
  currentPageUrl: string
  targetHref: string
}) {
  const { currentPageUrl, targetHref } = params

  if (!targetHref || targetHref.startsWith('javascript:')) {
    return targetHref
  }

  if (targetHref.startsWith('#')) {
    return targetHref
  }

  const absoluteTargetUrl = new URL(targetHref, currentPageUrl)
  const targetHash = absoluteTargetUrl.hash
  const normalizedPageUrl = normalizeFrameworkPageUrl(absoluteTargetUrl.toString(), currentPageUrl)

  if (!normalizedPageUrl) {
    return absoluteTargetUrl.toString()
  }

  const fromPath = toMirrorRelativePath(currentPageUrl)
  const toPath = toMirrorRelativePath(normalizedPageUrl)

  if (fromPath === toPath) {
    return targetHash || '#'
  }

  let relativePath = path.relative(path.dirname(fromPath), toPath)
  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`
  }

  return `${relativePath}${targetHash}`
}

export function toRelativeAssetPath(params: {
  currentPageUrl: string
  assetRelativePath: string
}) {
  const { currentPageUrl, assetRelativePath } = params
  const fromPath = toMirrorRelativePath(currentPageUrl)
  let relativePath = path.relative(path.dirname(fromPath), assetRelativePath)

  if (!relativePath.startsWith('.')) {
    relativePath = `./${relativePath}`
  }

  return relativePath
}
