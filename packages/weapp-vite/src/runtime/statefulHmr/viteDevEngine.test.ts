import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

it.each(['native', 'windows-id'] as const)('keeps native Vite TypeScript transforms active with %s IDs when loaded by tsx', async (idStyle) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vite-engine-identity-')))
  const entry = path.join(root, 'entry.ts')
  await writeFile(entry, 'const result: number = 42; export { result }')
  const loader = new URL('./viteDevEngine.ts', import.meta.url).href
  try {
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
      import { readFileSync } from 'node:fs'
      import { loadViteRolldown } from ${JSON.stringify(loader)}
      import { viteTransformPlugin } from 'rolldown/experimental'
      const runtime = await loadViteRolldown()
      const entry = ${JSON.stringify(entry)}
      let transformed = false
      const seenIds = []
      await runtime.scan({
        input: entry,
        plugins: [
          {
            name: 'native-id-shape-fixture',
            resolveId(source) {
              if (${JSON.stringify(idStyle)} === 'windows-id' && source === entry) return entry.replaceAll('/', '\\\\')
            },
            load(id) {
              if (id.replaceAll('\\\\', '/') === entry.replaceAll('\\\\', '/')) return readFileSync(entry, 'utf8')
            },
          },
          viteTransformPlugin({
            root: ${JSON.stringify(root)},
            isServerConsumer: false,
            transformOptions: { tsconfig: false },
            include: [/\\.ts$/],
          }),
          {
            name: 'assert-typescript-transformed-before-post',
            enforce: 'post',
            transform(code, id) {
              seenIds.push(id)
              if (id.replaceAll('\\\\', '/') !== entry.replaceAll('\\\\', '/')) return null
              this.parse(code)
              if (code.includes(': number')) throw new Error('TypeScript reached the post hook')
              transformed = true
              return null
            },
          },
        ],
      })
      console.log(JSON.stringify({ transformed, seenIds }))
    `])
    const result = JSON.parse(stdout) as { transformed: boolean, seenIds: string[] }
    expect(result.transformed, JSON.stringify(result.seenIds)).toBe(true)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
