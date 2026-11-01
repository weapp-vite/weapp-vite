import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createProjectMock, selectMock } = vi.hoisted(() => ({
  createProjectMock: vi.fn(),
  selectMock: vi.fn(),
}))

vi.mock('@/createProject', () => ({ createProject: createProjectMock }))
vi.mock('@weapp-core/init', () => ({ initConfig: vi.fn() }))
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn().mockResolvedValue('interactive-app'),
  confirm: vi.fn().mockResolvedValue(false),
  select: selectMock,
}))
const originalCwd = process.cwd()
let originalArgv: string[]
let originalExitCode: typeof process.exitCode
let temporaryDirectory: string

beforeEach(async () => {
  originalArgv = process.argv
  originalExitCode = process.exitCode
  process.argv = process.argv.slice(0, 2)
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'create-weapp-vite-choices-'))
  process.chdir(temporaryDirectory)
  createProjectMock.mockReset()
  selectMock.mockReset()
  vi.resetModules()
})

afterEach(async () => {
  process.argv = originalArgv
  process.exitCode = originalExitCode
  process.chdir(originalCwd)
  await rm(temporaryDirectory, { recursive: true, force: true })
})

async function runCli() {
  const cli = await import('../src/cli')
  await cli.runPromise
}

describe('template and toolchain selection', () => {
  it('shows six common templates plus the more entry, then asks for the toolchain', async () => {
    selectMock.mockResolvedValueOnce('default').mockResolvedValueOnce('wv')
    await runCli()

    const [templatePrompt, toolchainPrompt] = selectMock.mock.calls.map(([prompt]) => prompt)
    expect(templatePrompt).toMatchObject({ message: '选择模板', default: 'default' })
    expect(templatePrompt.choices.map((choice: { value: string }) => choice.value)).toEqual([
      'default',
      'wevu',
      'wevu-tdesign',
      'tailwindcss',
      'tdesign',
      'vant',
      'more-templates',
    ])
    expect(toolchainPrompt).toMatchObject({ message: '选择工具链', default: 'wv' })
    expect(toolchainPrompt.choices.map((choice: { value: string }) => choice.value)).toEqual(['wv', 'vite', 'vite-plus'])
    expect(createProjectMock).toHaveBeenCalledWith('interactive-app', 'default', expect.objectContaining({ toolchain: 'wv' }))
  })

  it.each(['plugin', 'lib', 'multi-platform', 'multi-platform-sfc', 'react'])(
    'keeps %s available through the more menu',
    async (template) => {
      selectMock.mockResolvedValueOnce('more-templates').mockResolvedValueOnce(template).mockResolvedValueOnce('wv')
      await runCli()

      const morePrompt = selectMock.mock.calls[1]?.[0]
      expect(morePrompt.choices.map((choice: { value: string }) => choice.value)).toEqual([
        'plugin',
        'lib',
        'multi-platform',
        'multi-platform-sfc',
        'react',
      ])
      expect(morePrompt.choices.slice(0, 2).every((choice: { name: string }) => choice.name.startsWith('高级 · '))).toBe(true)
      expect(morePrompt.choices.slice(2).every((choice: { name: string }) => choice.name.startsWith('实验 · '))).toBe(true)
      expect(createProjectMock).toHaveBeenCalledWith('interactive-app', template, expect.objectContaining({ toolchain: 'wv' }))
    },
  )

  it.each(['wv', 'vite', 'vite-plus'])('passes an interactive %s toolchain choice independently of the template', async (toolchain) => {
    selectMock.mockResolvedValueOnce('wevu').mockResolvedValueOnce(toolchain)
    await runCli()
    expect(createProjectMock).toHaveBeenCalledWith('interactive-app', 'wevu', expect.objectContaining({ toolchain }))
  })

  it.each(['wv', 'vite', 'vite-plus'])('uses explicit --toolchain=%s without prompting for a toolchain', async (toolchain) => {
    process.argv.push(`--toolchain=${toolchain}`)
    selectMock.mockResolvedValueOnce('default')
    await runCli()
    expect(selectMock).toHaveBeenCalledTimes(1)
    expect(createProjectMock).toHaveBeenCalledWith('interactive-app', 'default', expect.objectContaining({ toolchain }))
  })

  it.each(['plugin', 'lib', 'multi-platform', 'multi-platform-sfc', 'react'])(
    'preserves non-interactive access to %s without showing either menu',
    async (template) => {
      process.argv.push('app', template)
      await runCli()
      expect(selectMock).not.toHaveBeenCalled()
      expect(createProjectMock).toHaveBeenCalledWith('app', template, expect.objectContaining({ toolchain: 'wv' }))
    },
  )

  it('preserves default template and wv for non-interactive creation without options', async () => {
    process.argv.push('app')
    await runCli()
    expect(selectMock).not.toHaveBeenCalled()
    expect(createProjectMock).toHaveBeenCalledWith('app', 'default', expect.objectContaining({ toolchain: 'wv' }))
  })

  it('cancels the more menu without creating a project', async () => {
    selectMock.mockResolvedValueOnce('more-templates').mockRejectedValueOnce(new Error('User cancelled'))
    await runCli()
    expect(createProjectMock).not.toHaveBeenCalled()
  })
})
