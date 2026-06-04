import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/fs'
// eslint-disable-next-line e18e/ban-dependencies
import { execa } from 'execa'
import { TemplateName } from '@/enums'

function parsePackJson(stdout: string) {
  const jsonText = stdout.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/)?.[0]
  if (!jsonText) {
    throw new Error('npm pack --json 未返回任何输出')
  }
  return JSON.parse(jsonText) as Array<{
    files?: Array<{ path: string }>
  }>
}

describe('create-weapp-vite release pack', () => {
  it('includes dist assets and packaged templates in npm pack output', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '..')
    const workspaceTemplateRoot = path.resolve(packageRoot, '../../templates/weapp-vite-plugin-template')
    const generatedTemplateFile = path.join(workspaceTemplateRoot, 'dist-plugin', 'pack-sentinel.js')
    const generatedTemplateDirExisted = await fs.pathExists(path.dirname(generatedTemplateFile))
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-pack-cache-'))

    try {
      await fs.outputFile(generatedTemplateFile, 'generated')

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

      expect(packedFiles.has('bin/create-weapp-vite.js')).toBe(true)
      expect(packedFiles.has('dist/cli.js')).toBe(true)
      expect(packedFiles.has('dist/index.js')).toBe(true)

      for (const templateName of Object.values(TemplateName)) {
        expect(packedFiles.has(`templates/${templateName}/package.json`)).toBe(true)
      }

      expect(packedFiles.has('templates/default/project.config.json')).toBe(true)
      expect([...packedFiles].some(file => file.startsWith('templates/plugin/dist-'))).toBe(false)
    }
    finally {
      await fs.remove(generatedTemplateFile)
      if (!generatedTemplateDirExisted) {
        await fs.remove(path.dirname(generatedTemplateFile))
      }
      await fs.remove(cacheDir)
    }
  })
})
