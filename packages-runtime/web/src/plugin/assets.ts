import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, relative, resolve } from 'pathe'
import { normalizePath } from './path'

const WEB_ASSET_EXTENSIONS = new Set([
  '.aac',
  '.avif',
  '.br',
  '.cer',
  '.cert',
  '.gif',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.mp3',
  '.mp4',
  '.ogg',
  '.otf',
  '.png',
  '.silk',
  '.svg',
  '.ttf',
  '.wasm',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
])

const WEB_ASSET_CONTENT_TYPES: Record<string, string> = {
  '.aac': 'audio/aac',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

interface WebAssetPluginContext {
  addWatchFile?: (id: string) => void
  emitFile?: (asset: { type: 'asset', fileName: string, source: Uint8Array }) => void
}

type WebAssetNext = (error?: unknown) => void

function isWebAssetFile(filename: string) {
  return WEB_ASSET_EXTENSIONS.has(extname(filename).toLowerCase())
}

function isInsideRoot(root: string, filename: string) {
  const relativePath = normalizePath(relative(root, filename))
  return relativePath !== '..'
    && !relativePath.startsWith('../')
    && !relativePath.startsWith('/')
}

export function resolveWebAssetRequest(srcRoot: string, requestUrl?: string) {
  if (!requestUrl) {
    return undefined
  }
  let pathname: string
  try {
    const rawPath = decodeURIComponent(requestUrl.split(/[?#]/, 1)[0] ?? '')
    if (rawPath.split('/').includes('..')) {
      return undefined
    }
    pathname = decodeURIComponent(new URL(requestUrl, 'http://weapp-vite.local').pathname)
  }
  catch {
    return undefined
  }
  const relativePath = pathname.replace(/^\/+/, '')
  if (!relativePath || !isWebAssetFile(relativePath)) {
    return undefined
  }
  const filename = resolve(srcRoot, relativePath)
  return isInsideRoot(srcRoot, filename) ? filename : undefined
}

async function collectWebAssetFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const filename = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectWebAssetFiles(filename))
    }
    else if (entry.isFile() && isWebAssetFile(filename)) {
      files.push(filename)
    }
  }
  return files
}

export async function emitWebAssets(context: WebAssetPluginContext, srcRoot: string) {
  if (!context.emitFile) {
    return
  }
  const files = await collectWebAssetFiles(srcRoot)
  for (const filename of files) {
    const fileName = normalizePath(relative(srcRoot, filename))
    context.addWatchFile?.(filename)
    context.emitFile({
      type: 'asset',
      fileName,
      source: await readFile(filename),
    })
  }
}

export function createWebAssetMiddleware(srcRoot: string) {
  return (request: IncomingMessage, response: ServerResponse, next: WebAssetNext) => {
    const filename = resolveWebAssetRequest(srcRoot, request.url)
    if (!filename) {
      next()
      return
    }
    void stat(filename).then((fileStat) => {
      if (!fileStat.isFile()) {
        next()
        return
      }
      const extension = extname(filename).toLowerCase()
      response.statusCode = 200
      response.setHeader('Content-Length', String(fileStat.size))
      response.setHeader('Content-Type', WEB_ASSET_CONTENT_TYPES[extension] ?? 'application/octet-stream')
      const stream = createReadStream(filename)
      stream.on('error', next)
      stream.pipe(response)
    }).catch(() => next())
  }
}
