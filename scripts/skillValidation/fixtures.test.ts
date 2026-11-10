import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { hashSkillTree } from './fixtures.mjs'

const owned: string[] = []
afterEach(async () => {
  await Promise.all(owned.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function tree(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-evidence-'))
  owned.push(root)
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content)
  }
  return root
}

describe('full skill-tree evidence identity', () => {
  it('invalidates prior evidence when a nested reference or agent metadata changes', async () => {
    const root = await tree({ 'SKILL.md': '# Guide', 'references/runtime.md': 'old API', 'agents/openai.yaml': 'name: guide' })
    const original = await hashSkillTree(root)
    await fs.writeFile(path.join(root, 'references/runtime.md'), 'new API')
    const changedReference = await hashSkillTree(root)
    expect(changedReference).not.toBe(original)
    await fs.writeFile(path.join(root, 'agents/openai.yaml'), 'name: updated')
    expect(await hashSkillTree(root)).not.toBe(changedReference)
  })

  it('distinguishes file boundaries even when content contains framing delimiters', async () => {
    const one = await tree({ a: 'x\0b\0y' })
    const two = await tree({ a: 'x', b: 'y' })
    expect(await hashSkillTree(one)).not.toBe(await hashSkillTree(two))
  })

  it('rejects linked sources instead of silently excluding externally mutable content', async () => {
    const root = await tree({ 'SKILL.md': '# Guide' })
    const external = await tree({ 'runtime.md': 'untracked external API' })
    await fs.symlink(external, path.join(root, 'linked-references'), 'junction')
    await expect(hashSkillTree(root)).rejects.toThrow('must not contain symbolic links')
  })
})
