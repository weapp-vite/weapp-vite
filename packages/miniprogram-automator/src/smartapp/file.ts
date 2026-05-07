/**
 * @file 百度智能小程序自动化文件工具。
 */
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function mkdir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function rmdir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true })
}

export async function wget(url: string, targetPath: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed downloading ${url}: ${response.status} ${response.statusText}`)
  }
  await mkdir(path.dirname(targetPath))
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(targetPath, buffer)
}

export async function changeProjectSwanJson(projectPath: string, values: Record<string, unknown>) {
  const swanJsonPath = path.resolve(projectPath, 'project.swan.json')
  const raw = await fs.readFile(swanJsonPath, 'utf8')
  const current = JSON.parse(raw) as Record<string, unknown>
  await fs.writeFile(swanJsonPath, JSON.stringify({ ...current, ...values }, null, 2), 'utf8')
}

export const file = {
  changeProjectSwanJson,
  mkdir,
  rmdir,
  wget,
}
