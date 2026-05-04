import { readdir, readFile } from 'node:fs/promises'
import path from 'pathe'

const TEMPLATE_SRC_ROOT = path.resolve(
  import.meta.dirname,
  '../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src',
)

const SOURCE_EXTENSIONS = new Set(['.ts', '.vue'])

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath)
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      return []
    }
    return [fullPath]
  }))
  return files.flat()
}

describe('retail template console warnings', () => {
  it('does not ship direct console.warn calls in template source', async () => {
    const files = await collectSourceFiles(TEMPLATE_SRC_ROOT)
    const matches: string[] = []

    await Promise.all(files.map(async (file) => {
      const source = await readFile(file, 'utf8')
      if (source.includes('console.warn')) {
        matches.push(path.relative(TEMPLATE_SRC_ROOT, file))
      }
    }))

    expect(matches).toEqual([])
  })
})
