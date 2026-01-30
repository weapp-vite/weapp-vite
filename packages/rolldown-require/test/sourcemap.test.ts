import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

const fixtureEntry = path.join(__dirname, './fixture/input.ts')

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

it('uses inline sourcemap when explicitly requested', async () => {
  const generateSpy = vi.fn(async () => {
    return {
      output: [
        {
          type: 'chunk',
          isEntry: true,
          fileName: 'entry.js',
          code: 'export const value = 1',
          moduleIds: [fixtureEntry],
          imports: [],
          dynamicImports: [],
        },
      ],
    }
  })
  const rolldownSpy = vi.fn(async () => ({
    generate: generateSpy,
    close: vi.fn(async () => {}),
  }))
  vi.doMock('rolldown', () => ({ rolldown: rolldownSpy }))

  const { bundleFile } = await import('../src/bundler')
  await bundleFile(fixtureEntry, {
    isESM: true,
    format: 'esm',
    sourcemap: true,
  } as any)

  expect(generateSpy).toHaveBeenCalled()
  const outputOptions = generateSpy.mock.calls[0]?.[0]
  expect(outputOptions?.sourcemap).toBe('inline')
})

it('auto-enables inline sourcemap when debugging', async () => {
  const previousNodeOptions = process.env.NODE_OPTIONS
  process.env.NODE_OPTIONS = '--inspect'

  const bundleFileMock = vi.fn(async () => ({
    code: 'export const value = 1',
    dependencies: [],
  }))
  const loadMock = vi.fn(async () => ({ value: 1 }))
  vi.doMock('../src/bundler', () => ({ bundleFile: bundleFileMock }))
  vi.doMock('../src/loader', () => ({ loadFromBundledFile: loadMock }))

  try {
    const { bundleRequire } = await import('../src/index')
    const result = await bundleRequire({
      filepath: fixtureEntry,
      cwd: __dirname,
    })
    expect(result.mod.value).toBe(1)
    expect(bundleFileMock).toHaveBeenCalled()
    const internalOptions = bundleFileMock.mock.calls[0]?.[1]
    expect(internalOptions?.sourcemap).toBe('inline')
  }
  finally {
    process.env.NODE_OPTIONS = previousNodeOptions
    vi.unmock('../src/bundler')
    vi.unmock('../src/loader')
  }
})
