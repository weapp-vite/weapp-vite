import os from 'node:os'

import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { normalizeMiniprogramPackageJsModules, transformJsModuleToCjs } from './builder/jsModule'

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-builder-js-module-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  tempDirs.length = 0
})

describe('runtime npm builder js module transform', () => {
  it('does not export function parameters when converting named function exports', async () => {
    const output = await transformJsModuleToCjs([
      'export function isFunction(t) {',
      '  return typeof t === "function"',
      '}',
      'export function isDate(t, e) {',
      '  return Boolean(t || e)',
      '}',
    ].join('\n'), {
      markEsModule: true,
    })

    expect(output).toContain('__esModule')
    expect(output).toContain('exports.isFunction = isFunction')
    expect(output).toContain('exports.isDate = isDate')
    expect(output).not.toContain('exports.t = t')
    expect(output).not.toContain('exports.e = e')
  })

  it('normalizes sibling js files concurrently', async () => {
    const root = await createTempDir()
    await fs.writeFile(path.resolve(root, 'alpha.js'), 'export const alpha = 1', 'utf8')
    await fs.writeFile(path.resolve(root, 'beta.js'), 'export const beta = 2', 'utf8')
    await fs.writeFile(path.resolve(root, 'plain.json'), '{}', 'utf8')

    const originalReadFile = fs.readFile.bind(fs)
    const startedReads = new Set<string>()
    let releaseFirstRead: (() => void) | undefined
    let resolveBothReadsStarted: (() => void) | undefined
    const bothReadsStarted = new Promise<void>((resolve) => {
      resolveBothReadsStarted = resolve
    })

    vi.spyOn(fs, 'readFile').mockImplementation(async (filePath: any, ...args: any[]) => {
      const relPath = path.relative(root, String(filePath)).replace(/\\/g, '/')
      if (relPath === 'alpha.js' || relPath === 'beta.js') {
        startedReads.add(relPath)
        if (startedReads.size === 2) {
          resolveBothReadsStarted?.()
        }
        if (!releaseFirstRead) {
          await new Promise<void>((resolve) => {
            releaseFirstRead = resolve
          })
        }
      }
      return originalReadFile(filePath, ...args)
    })

    const normalizePromise = normalizeMiniprogramPackageJsModules(root, {
      markEsModule: true,
    })
    const startResult = await Promise.race([
      bothReadsStarted.then(() => 'both-started'),
      new Promise(resolve => setTimeout(resolve, 50, 'timeout')),
    ])
    releaseFirstRead?.()
    await expect(normalizePromise).resolves.toBeUndefined()

    expect(startResult).toBe('both-started')
    expect(startedReads).toEqual(new Set(['alpha.js', 'beta.js']))
    expect(await fs.readFile(path.resolve(root, 'alpha.js'), 'utf8')).toContain('exports.alpha')
    expect(await fs.readFile(path.resolve(root, 'beta.js'), 'utf8')).toContain('exports.beta')
  })
})
