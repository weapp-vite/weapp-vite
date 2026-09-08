import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

it('keeps native Vite TypeScript transforms active when the source CLI is loaded by tsx', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vite-engine-identity-')))
  const entry = path.join(root, 'entry.ts')
  await writeFile(entry, 'const result: number = 42; export { result }')
  const loader = new URL('./viteDevEngine.ts', import.meta.url).href
  try {
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
      import { loadViteRolldown } from ${JSON.stringify(loader)}
      import { viteTransformPlugin } from 'rolldown/experimental'
      const runtime = await loadViteRolldown()
      const entry = ${JSON.stringify(entry)}
      let transformed = false
      await runtime.scan({
        input: entry,
        plugins: [
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
              if (id !== entry.replaceAll('\\\\', '/')) return null
              this.parse(code)
              if (code.includes(': number')) throw new Error('TypeScript reached the post hook')
              transformed = true
              return null
            },
          },
        ],
      })
      console.log(JSON.stringify({ transformed }))
    `])
    expect(JSON.parse(stdout)).toEqual({ transformed: true })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
