import type { Buffer } from 'node:buffer'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export type Assets = Map<string, Buffer>

export async function collectAssets(directory: string, prefix = ''): Promise<Assets> {
  const assets: Assets = new Map()
  async function visit(current: string, relative: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name)
      const name = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await visit(file, name)
      }
      else if (entry.isFile()) {
        assets.set(`${prefix}${name}`, await readFile(file))
      }
    }
  }
  await visit(directory, '')
  return assets
}

export function assetContentType(name: string) {
  const types: Record<string, string> = {
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2',
  }
  return types[path.extname(name)] ?? 'application/octet-stream'
}
