import type { XmlParserConstructor } from '../assertions/xml'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** 基线由拥有包的依赖解析，工具不会意外选择全局安装或源码模拟实现。 */
export async function loadXmlBaseline() {
  const require = createRequire(new URL('../../../packages/wxml/package.json', import.meta.url))
  const entry = require.resolve('htmlparser2')
  const metadata: unknown = JSON.parse(await readFile(path.join(path.dirname(entry), '../package.json'), 'utf8'))
  if (!metadata || typeof metadata !== 'object' || !('version' in metadata) || typeof metadata.version !== 'string') {
    throw new TypeError('Invalid htmlparser2 baseline package identity.')
  }
  const entrySha256 = createHash('sha256').update(await readFile(entry)).digest('hex')
  const entryUrl = pathToFileURL(entry)
  entryUrl.searchParams.set('corpus-artifact', entrySha256)
  const module = await import(entryUrl.href) as { Parser: XmlParserConstructor }
  return { Parser: module.Parser, entry, entrySha256, version: metadata.version }
}
