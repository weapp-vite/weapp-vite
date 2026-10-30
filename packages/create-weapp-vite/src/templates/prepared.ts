import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

/** 对文件路径和原始内容一起取摘要；不跟随模板中的符号链接。 */
export async function digestDirectory(root: string): Promise<string> {
  const hash = createHash('sha256')
  async function walk(directory: string) {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(file)
      }
      else if (entry.isFile()) {
        hash.update(path.relative(root, file).split(path.sep).join('/'))
        hash.update(await fs.readFile(file))
      }
      else {
        throw new Error(`派生模板包含不支持的文件类型：${path.relative(root, file)}`)
      }
    }
  }
  await walk(root)
  return hash.digest('hex')
}

/** 复制前验证发布清单和完整副本，损坏时禁止退回未经准备的业务源码。 */
export async function assertPreparedTemplate(directory: string, id: string): Promise<void> {
  try {
    const manifest: unknown = JSON.parse(await fs.readFile(path.join(directory, '../manifest.json'), 'utf8'))
    const templates = manifest && typeof manifest === 'object' && 'templates' in manifest
      ? manifest.templates
      : undefined
    const expected = templates && typeof templates === 'object' && Object.hasOwn(templates, id)
      ? (templates as Record<string, unknown>)[id]
      : undefined
    if (typeof expected !== 'string' || !/^[a-f\d]{64}$/.test(expected)) {
      throw new Error('发布清单缺少有效模板摘要')
    }
    for (const file of ['package.json', 'AGENTS.md', 'vite.config.ts', 'weapp-vite.config.ts']) {
      if (!(await fs.lstat(path.join(directory, file))).isFile()) {
        throw new Error(`关键文件不是普通文件：${file}`)
      }
    }
    if (await digestDirectory(directory) !== expected) {
      throw new Error('模板文件与发布清单摘要不一致')
    }
  }
  catch (cause) {
    throw new Error(`Vite Plus 派生模板 ${id} 缺失或损坏，请运行 pnpm --filter create-weapp-vite templates:prepare 后重试；发布包须包含完整派生模板。`, { cause })
  }
}
