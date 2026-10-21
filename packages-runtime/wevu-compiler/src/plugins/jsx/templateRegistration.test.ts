import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { compileJsxFile } from './compileJsxFile'

const roots: string[] = []
const filename = 'src/pages/compiled/index.tsx'
const source = `import { defineComponent } from 'wevu'
const renderDynamic = value => value
export default defineComponent({
  data() { return { count: 0 } },
  methods: { increment() { this.count += 1 } },
  render() { return <view>{renderDynamic(<button onTap={this.increment}>{this.count}</button>)}</view> },
})`

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('JSX compiled template registration signatures', () => {
  it.each(['jsx', 'tsx'])('includes statically expanded shared %s template changes', async (extension) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-registration-'))
    roots.push(root)
    const shared = path.join(root, `shared.${extension}`)
    const entry = path.join(root, `page.${extension}`)
    const page = `import { defineComponent } from 'wevu'
import { sharedFragment } from './shared'
export default defineComponent({ render() { return <view>{sharedFragment}</view> } })`
    await writeFile(shared, 'export const sharedFragment = <text>before</text>')
    const before = await compileJsxFile(page, entry)
    await writeFile(shared, 'export const sharedFragment = <text>after</text>')
    const after = await compileJsxFile(page, entry)
    expect(before.template).toContain('<text>before</text>')
    expect(after.template).toContain('<text>after</text>')
    expect(before.meta?.templateRegistrationSignature).toEqual(expect.any(String))
    expect(after.meta?.templateRegistrationSignature).not.toBe(before.meta?.templateRegistrationSignature)
  })

  it('keeps a method body update outside the dynamic island registration boundary', async () => {
    const before = await compileJsxFile(source, filename)
    const after = await compileJsxFile(source.replace('this.count += 1', 'this.count += 2'), filename)
    expect(before.meta?.jsxDynamicIslands).toHaveLength(1)
    expect(after.script).not.toBe(before.script)
    expect(after.template).toBe(before.template)
    expect(before.meta?.templateRegistrationSignature).toEqual(expect.any(String))
    expect(after.meta?.templateRegistrationSignature).toBe(before.meta?.templateRegistrationSignature)
  })

  it.each([
    ['inline event', '<button onTap={() => this.increment(1)}>advance</button>', 'increment(1)', 'increment(2)'],
    ['computed binding', '<view title={this.format(this.count + 1)} />', 'count + 1', 'count + 2'],
    ['dynamic island', '<view>{renderDynamic(this.count + 1)}</view>', 'count + 1', 'count + 2'],
  ])('includes %s expressions even when generated template slots stay the same', async (_kind, render, previous, current) => {
    const page = source.replace('return <view>{renderDynamic(<button onTap={this.increment}>{this.count}</button>)}</view>', `return ${render}`)
    const before = await compileJsxFile(page, filename)
    const after = await compileJsxFile(page.replace(previous, current), filename)
    expect(after.template).toBe(before.template)
    expect(after.script).not.toBe(before.script)
    expect(before.meta?.templateRegistrationSignature).toEqual(expect.any(String))
    expect(after.meta?.templateRegistrationSignature).not.toBe(before.meta?.templateRegistrationSignature)
  })

  it('preserves syntax failures instead of manufacturing a registration signature', async () => {
    await expect(compileJsxFile(source.replace('count: 0', 'count: )'), filename)).rejects.toThrow()
  })

  it('signs the shared source returned by the frozen reader rather than a later save', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-registration-'))
    roots.push(root)
    const shared = path.join(root, 'shared.tsx')
    const entry = path.join(root, 'page.tsx')
    const page = `import { defineComponent } from 'wevu'
import { sharedFragment } from './shared'
export default defineComponent({ render() { return <view>{sharedFragment}</view> } })`
    const original = 'export const sharedFragment = <text>frozen-shared</text>'
    await writeFile(shared, original)
    const before = await compileJsxFile(page, entry)
    await writeFile(shared, 'export const sharedFragment = <text>later-shared</text>')
    const frozen = await compileJsxFile(page, entry, {
      jsx: { readFile: file => file === shared ? original : readFileSync(file, 'utf8') },
    })
    const live = await compileJsxFile(page, entry)
    expect(frozen.template).toContain('frozen-shared')
    expect(frozen.template).not.toContain('later-shared')
    expect(frozen.meta?.templateRegistrationSignature).toBe(before.meta?.templateRegistrationSignature)
    expect(live.meta?.templateRegistrationSignature).not.toBe(before.meta?.templateRegistrationSignature)
  })

  it('preserves reader failures instead of silently trying another shared module', async () => {
    const failure = new Error('frozen input is unavailable')
    const page = `import { defineComponent } from 'wevu'
import { sharedFragment } from './shared'
export default defineComponent({ render() { return <view>{sharedFragment}</view> } })`
    await expect(compileJsxFile(page, filename, {
      jsx: { readFile: () => { throw failure } },
    })).rejects.toBe(failure)
  })
})
