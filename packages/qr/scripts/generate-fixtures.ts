/**
 * @file 根据 fixture manifest 生成基础二维码 PNG。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { argv } from 'node:process'
import { fileURLToPath } from 'node:url'
import { createQrCodeMatrix } from '../src/encode'
import { encodeQrCodeMatrixToPngBuffer } from '../test/helpers/createQrCodePng'

interface FixtureManifestEntry {
  file: string
  content: string
  kind: string
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = resolve(packageRoot, 'test/fixtures')
const manifestPath = resolve(fixtureRoot, 'manifest.json')

function isFixtureManifestEntry(value: unknown): value is FixtureManifestEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Record<string, unknown>
  return typeof entry.file === 'string'
    && typeof entry.content === 'string'
    && typeof entry.kind === 'string'
}

/** 读取并校验 fixture manifest。 */
async function readFixtureManifest(): Promise<FixtureManifestEntry[]> {
  const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (!Array.isArray(parsed) || !parsed.every(isFixtureManifestEntry)) {
    throw new TypeError('二维码 fixture manifest 格式无效')
  }
  return parsed
}

function readTargetFile(): string {
  const fileArgument = argv.find(argument => argument.startsWith('--file='))
  const targetFile = fileArgument?.slice('--file='.length)
  if (!targetFile) {
    throw new Error('请通过 --file=<fixture.png> 指定要生成的 fixture')
  }
  return targetFile
}

async function main() {
  const targetFile = readTargetFile()
  const manifest = await readFixtureManifest()
  const fixture = manifest.find(entry => entry.file === targetFile)

  if (!fixture) {
    throw new Error(`fixture manifest 中不存在 ${targetFile}`)
  }
  if (fixture.kind !== 'basic') {
    throw new Error(`${targetFile} 不是可直接生成的 basic fixture`)
  }

  const matrix = createQrCodeMatrix(fixture.content)
  const png = await encodeQrCodeMatrixToPngBuffer(matrix)
  await writeFile(resolve(fixtureRoot, fixture.file), png)
  console.log(`已生成 test/fixtures/${fixture.file}`)
}

await main()
