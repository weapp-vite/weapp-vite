import { describe, expect, it, vi } from 'vitest'
import { waitForBenchmarkOutput } from './emittedOutput'
import { normalizeBenchmarkStylesheet } from './styleOutput'

describe('benchmark stylesheet restoration', () => {
  const signature = normalizeBenchmarkStylesheet

  it.each(['compiler-content', 'tailwind-content'])('restores an empty placeholder after the previous %s update', async (reason) => {
    const original = `/* empty */\r\n/* weapp-vite ${reason} previous-batch */`
    const read = vi.fn()
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('/* empty */\n.hmr-bench-marker { color: red; }')
      .mockResolvedValue('/* empty */')
    await expect(waitForBenchmarkOutput(async () => signature(await read()), 'hmr-bench-marker', {
      absent: true,
      expectedContent: signature(original),
      timeoutMs: 100,
      intervalMs: 1,
    })).resolves.toBe(signature('/* empty */'))
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('ignores CSS formatting while preserving nested rules and declarations', () => {
    expect(signature('@media screen { .page { color: red !important; padding: 1px; } }\r\n'))
      .toBe(signature('@media screen{.page{color:red!important;padding:1px}}'))
  })

  it.each([
    ['selector', '.other { color: red !important; padding: 1px; }'],
    ['property', '.page { background: red !important; padding: 1px; }'],
    ['value', '.page { color: blue !important; padding: 1px; }'],
    ['important', '.page { color: red; padding: 1px; }'],
    ['declaration order', '.page { padding: 1px; color: red !important; }'],
    ['extra rule', '.page { color: red !important; padding: 1px; } .stale { color: red; }'],
    ['missing rule', ''],
  ])('rejects changed %s even without the mutation marker', async (_label, output) => {
    await expect(waitForBenchmarkOutput(async () => signature(output), 'hmr-bench-marker', {
      absent: true,
      expectedContent: signature('.page { color: red !important; padding: 1px; }'),
      timeoutMs: 10,
      intervalMs: 1,
    })).rejects.toThrow('Timed out')
  })

  it.each([
    '@import "./other.wxss"; .page { color: red; }',
    '.page { color: red; } @import "./shared.wxss";',
    '@import "./shared.wxss"; .page { color: red; } @media print {}',
  ])('keeps imports, at-rule parameters and order: %s', (output) => {
    expect(signature(output)).not.toBe(signature('@import "./shared.wxss"; .page { color: red; }'))
  })

  it('keeps ordinary and license comments so an empty partial write cannot restore a placeholder', () => {
    expect(signature('/* empty */')).not.toBe(signature(''))
    expect(signature('/*! license */ .page {}')).not.toBe(signature('.page {}'))
    expect(signature('/* weapp-vite compiler-content */')).not.toBe(signature(''))
    expect(signature('/* author compiler-content previous-batch */')).not.toBe(signature(''))
  })

  it('rejects malformed CSS instead of comparing it as restored', async () => {
    expect(() => signature('.page { color: red;')).toThrow()
    await expect(waitForBenchmarkOutput(async () => signature('.page { color: red;'), 'hmr-bench-marker', {
      absent: true,
      expectedContent: signature('.page { color: red; }'),
      timeoutMs: 10,
      intervalMs: 1,
    })).rejects.toThrow('Unclosed block')
  })
})
