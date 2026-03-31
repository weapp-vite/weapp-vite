/**
 * @file 二维码夹具读取辅助方法。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface QrFixtureDescriptor {
  file: string
  content: string
  kind: string
}

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../fixtures')

/** loadQrFixtures 的方法封装。 */
export async function loadQrFixtures() {
  const manifestPath = path.join(FIXTURE_ROOT, 'manifest.json')
  const content = await readFile(manifestPath, 'utf8')
  return JSON.parse(content) as QrFixtureDescriptor[]
}

/** loadQrFixtureBase64 的方法封装。 */
export async function loadQrFixtureBase64(fileName: string) {
  const filePath = path.join(FIXTURE_ROOT, fileName)
  const buffer = await readFile(filePath)
  return buffer.toString('base64')
}
