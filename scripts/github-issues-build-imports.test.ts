import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')
const buildRoot = path.join(root, 'e2e/ci/githubIssuesBuild')

it('resolves every migrated legacy import to a Git-visible source file without loading build cases', async () => {
  const visibleFiles = new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'e2e'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0').filter(Boolean))
  const unresolved: string[] = []
  const hidden: string[] = []
  const files = await Array.fromAsync(fs.glob('**/*.ts', { cwd: path.join(buildRoot, 'legacy') }))
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const filename = path.join(buildRoot, 'legacy', file)
    const source = ts.preProcessFile(await fs.readFile(filename, 'utf8'))
    for (const imported of source.importedFiles) {
      if (!imported.fileName.startsWith('.')) {
        continue
      }
      const label = `${path.relative(root, filename).replaceAll('\\', '/')} -> ${imported.fileName}`
      const resolved = ts.resolveModuleName(imported.fileName, filename, {
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowJs: true,
        resolveJsonModule: true,
      }, ts.sys).resolvedModule
      if (!resolved) {
        unresolved.push(label)
      }
      else if (!visibleFiles.has(path.relative(root, resolved.resolvedFileName).replaceAll('\\', '/'))) {
        hidden.push(label)
      }
    }
  }
  expect(unresolved).toEqual([])
  expect(hidden).toEqual([])
})
