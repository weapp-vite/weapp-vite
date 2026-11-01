import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { optionValues } from './build.mjs'

interface PublicOptions {
  [key: string]: unknown
}

function harness(afterClose?: (owner: 'input' | 'output' | 'callback', key: string) => void) {
  let closed = false
  const reads: Array<{ owner: string, key: string }> = []
  const retained = (owner: 'input' | 'output', options: PublicOptions) => new Proxy(options, {
    get(target, key: string) {
      if (closed) {
        reads.push({ owner, key })
        afterClose?.(owner, key)
      }
      return target[key]
    },
  })
  const bundle = {
    closed: false,
    generate: vi.fn(),
    close: vi.fn(async () => {
      closed = true
      bundle.closed = true
    }),
  }
  const rolldown = vi.fn(async (options: PublicOptions & { plugins: Array<{ renderStart: (output: PublicOptions, input: PublicOptions) => Promise<void> }> }) => {
    const input = retained('input', { ...options, shimMissingExports: false })
    bundle.generate.mockImplementationOnce(async (requested: PublicOptions) => {
      const output = retained('output', {
        charset: 'utf8',
        exports: 'auto',
        shimMissingExports: false,
        codeSplitting: true,
        inlineDynamicImports: false,
        dynamicImportInCjs: true,
        externalLiveBindings: true,
        esModule: 'if-default-prop',
        extend: false,
        hashCharacters: 'base64',
        sourcemapDebugIds: false,
        sourcemapExcludeSources: false,
        legalComments: 'inline',
        polyfillRequire: true,
        plugins: [],
        preserveModules: false,
        preserveModulesRoot: null,
        virtualDirname: '_virtual',
        topLevelVar: false,
        minifyInternalExports: true,
        ...requested,
        minify: { mangleProps: { ...(requested.minify as { mangleProps: object }).mangleProps, quoted: false, debug: false, cache: {} } },
        ...Object.fromEntries(['footer', 'postBanner', 'postFooter', 'intro', 'outro'].map(key => [key, async () => {
          if (closed) {
            reads.push({ owner: 'callback', key })
            afterClose?.('callback', key)
          }
          return requested[key]
        }])),
      })
      await options.plugins[0]!.renderStart(output, input)
      return { output: [{ type: 'chunk', isEntry: true, exports: ['result'], code: 'export const result = 42', fileName: 'entry.js' }] }
    })
    return bundle
  })
  return { rolldown, bundle, reads }
}

async function run(afterClose?: Parameters<typeof harness>[0]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rolldown-public-options-'))
  const state = harness(afterClose)
  try {
    const observation = await optionValues(state.rolldown, root)
    return { ...state, observation }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}

it('reads retained public options and invokes normalized string callbacks after close', async () => {
  const state = await run()
  expect(state.bundle.closed).toBe(true)
  expect(state.reads).toEqual(expect.arrayContaining([
    { owner: 'input', key: 'context' },
    { owner: 'input', key: 'platform' },
    { owner: 'output', key: 'charset' },
    { owner: 'callback', key: 'footer' },
  ]))
  expect(state.observation.footer).toBe('/* footer */')
  expect(state.bundle.close).toHaveBeenCalledTimes(1)
})

it.each([
  ['input', 'platform'],
  ['output', 'charset'],
  ['callback', 'footer'],
] as const)('does not accept a snapshot captured before %s %s becomes unreadable at close', async (owner, key) => {
  const original = new Error(`Public ${owner} ${key} is unavailable after close`)
  await expect(run((candidateOwner, candidateKey) => {
    if (candidateOwner === owner && candidateKey === key) {
      throw original
    }
  })).rejects.toBe(original)
})
