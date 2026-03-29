import os from 'node:os'
import path from 'node:path'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
// eslint-disable-next-line e18e/ban-dependencies
import fs from 'fs-extra'

function parsePackJson(stdout: string) {
  const jsonText = stdout.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/)?.[0]
  if (!jsonText) {
    throw new Error('npm pack --json 未返回任何输出')
  }
  return JSON.parse(jsonText) as Array<{
    files?: Array<{ path: string }>
  }>
}

describe('weapp-vite release pack', () => {
  it('includes packaged dist docs in npm pack output', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-pack-cache-'))

    try {
      await execa('pnpm', ['build'], {
        cwd: packageRoot,
        env: {
          ...process.env,
          npm_config_loglevel: 'silent',
        },
      })

      const { stdout } = await execa(
        'npm',
        ['pack', '--json', '--dry-run', '.', '--cache', cacheDir],
        {
          cwd: packageRoot,
          env: {
            ...process.env,
            npm_config_loglevel: 'silent',
          },
        },
      )
      const [packResult] = parsePackJson(stdout)
      const packedFiles = new Set((packResult?.files ?? []).map(file => file.path))

      expect(packedFiles.has('dist/docs/index.md')).toBe(true)
      expect(packedFiles.has('dist/docs/README.md')).toBe(true)
      expect(packedFiles.has('dist/docs/mcp.md')).toBe(true)
      expect(packedFiles.has('dist/docs/volar.md')).toBe(true)
      expect(packedFiles.has('dist/docs/define-config-overloads.md')).toBe(true)
    }
    finally {
      await fs.remove(cacheDir)
    }
  })
})
