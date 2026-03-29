import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))

export default async function setup() {
  await fs.mkdir(path.resolve(ROOT_DIR, 'coverage/.tmp'), { recursive: true })
}
