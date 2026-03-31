/**
 * @file 二维码夹具读取辅助方法。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export interface QrFixtureDescriptor {
  file: string
  kind: string
  content?: string
  expectedError?: string
}

const FIXTURE_ROOT = path.resolve(import.meta.dirname, '../fixtures')

/** loadFixtureManifest 的方法封装。 */
export async function loadFixtureManifest(manifestRelativePath = 'manifest.json') {
  const manifestPath = path.join(FIXTURE_ROOT, manifestRelativePath)
  const content = await readFile(manifestPath, 'utf8')
  return JSON.parse(content) as QrFixtureDescriptor[]
}

/** loadQrFixtures 的方法封装。 */
export async function loadQrFixtures() {
  return await loadFixtureManifest()
}

/** loadQrFixtureBase64 的方法封装。 */
export async function loadQrFixtureBase64(fileRelativePath: string) {
  const filePath = path.join(FIXTURE_ROOT, fileRelativePath)
  const buffer = await readFile(filePath)
  return buffer.toString('base64')
}
