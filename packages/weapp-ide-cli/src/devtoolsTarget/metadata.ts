import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_HEADER_BYTES = 16 * 1024 * 1024
const MAX_PACKAGE_BYTES = 1024 * 1024

export interface WechatDevtoolsMetadata {
  version?: string
  channel?: 'stable' | 'rc' | 'nightly' | 'unknown'
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function readPackageFile(filePath: string) {
  const size = (await fs.stat(filePath)).size
  if (size > MAX_PACKAGE_BYTES) {
    throw new Error('DevTools package metadata exceeds the size limit.')
  }
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown
}

/** 只读取归档目录和根 package.json，不执行宿主代码或解包其他文件。 */
async function readAsarPackage(asarPath: string) {
  const file = await fs.open(asarPath, 'r')
  try {
    const stat = await file.stat()
    const prefix = Buffer.alloc(16)
    if ((await file.read(prefix, 0, prefix.length, 0)).bytesRead !== prefix.length) {
      throw new Error('Invalid DevTools ASAR header.')
    }
    const headerSize = prefix.readUInt32LE(4)
    const jsonSize = prefix.readUInt32LE(12)
    if (prefix.readUInt32LE(0) !== 4 || prefix.readUInt32LE(8) + 4 !== headerSize || headerSize < 8 || headerSize > MAX_HEADER_BYTES
      || jsonSize > headerSize - 8 || headerSize + 8 > stat.size) {
      throw new Error('Invalid DevTools ASAR header size.')
    }
    const header = Buffer.alloc(jsonSize)
    if ((await file.read(header, 0, jsonSize, 16)).bytesRead !== jsonSize) {
      throw new Error('Truncated DevTools ASAR header.')
    }
    const parsed: unknown = JSON.parse(header.toString('utf8'))
    const entry = record(parsed) && record(parsed.files) ? parsed.files['package.json'] : undefined
    if (!record(entry) || entry.link !== undefined) {
      throw new Error('DevTools ASAR has no direct package metadata.')
    }
    if (entry.unpacked === true) {
      return await readPackageFile(path.join(`${asarPath}.unpacked`, 'package.json'))
    }
    const size = entry.size
    const offset = typeof entry.offset === 'string' && /^\d+$/.test(entry.offset) ? Number(entry.offset) : Number.NaN
    const position = 8 + headerSize + offset
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0 || size > MAX_PACKAGE_BYTES
      || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(position) || position + size > stat.size) {
      throw new Error('Invalid DevTools ASAR package bounds.')
    }
    const content = Buffer.alloc(size)
    if ((await file.read(content, 0, size, position)).bytesRead !== size) {
      throw new Error('Truncated DevTools ASAR package metadata.')
    }
    return JSON.parse(content.toString('utf8')) as unknown
  }
  finally {
    await file.close()
  }
}

/** 产品版本来自应用 package.json，不能使用外层 Electron 的版本。 */
export async function readWechatDevtoolsMetadata(appPath: string): Promise<WechatDevtoolsMetadata> {
  const value = appPath.endsWith('.asar')
    ? await readAsarPackage(appPath)
    : await readPackageFile(path.join(appPath, 'package.json'))
  if (!record(value)) {
    throw new Error('Invalid DevTools package metadata.')
  }
  const productNames = [value.name, value.productName].filter((name): name is string => typeof name === 'string')
  if (!productNames.some(name => name === '微信开发者工具' || /wechat(?:web)?devtools/i.test(name))) {
    throw new Error('The selected application metadata does not identify WeChat DevTools.')
  }
  const version = typeof value.version === 'string' && /^\d+\.\d+\.\d+$/.test(value.version) ? value.version : undefined
  const channel = String(value.versionType) === '0'
    ? 'stable'
    : String(value.versionType) === '1'
      ? 'rc'
      : String(value.versionType) === '2' ? 'nightly' : 'unknown'
  return { version, channel }
}
