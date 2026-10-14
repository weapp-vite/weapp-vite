import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectExitedWechatInstallation } from './processes'

const mocks = vi.hoisted(() => ({ states: vi.fn(), paths: vi.fn(), images: vi.fn() }))
vi.mock('./darwin', () => ({ readDarwinProcessStates: mocks.states, readDarwinKernelPaths: mocks.paths, readDarwinTextImages: mocks.images }))
let directory: string
let target: ResolvedWechatDevtoolsTarget
const state = { pid: 21, started: 'first', zombie: false }

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'installation-inventory-test-')))
  const bundle = path.join(directory, 'selected.app')
  await fs.mkdir(bundle)
  target = { appPath: path.join(bundle, 'Contents/Resources/app.asar').replaceAll('\\', '/'), cliPath: path.join(bundle, 'Contents/MacOS/cli'), installationId: 'selected', profileDir: path.join(directory, 'profile') }
  mocks.states.mockResolvedValue([state])
  mocks.paths.mockResolvedValue(new Map([[21, null]]))
  mocks.images.mockRejectedValue(new Error('No complete text image inventory'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

async function executable(file: string) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, '')
  return file
}

function denyImageResolution(...files: string[]) {
  const realpath = fs.realpath
  vi.spyOn(fs, 'realpath').mockImplementation(async (file) => {
    if (files.includes(String(file))) {
      throw Object.assign(new Error('Permission denied'), { code: 'EACCES' })
    }
    return realpath(file)
  })
}

describe('installation-exit process inventory', () => {
  it('resolves app.asar to the bundle root and rejects a manual host in it', async () => {
    const file = await executable(path.join(directory, 'selected.app/Contents/MacOS/Electron'))
    mocks.paths.mockResolvedValue(new Map([[21, file]]))
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
  })

  it('does not confuse another installation or a common prefix with the selected bundle', async () => {
    const file = await executable(path.join(directory, 'selected.app-other/Contents/MacOS/Electron'))
    mocks.paths.mockResolvedValue(new Map([[21, file]]))
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ installationRoot: await fs.realpath(path.join(directory, 'selected.app')), inspectedProcessCount: 1, kernelPathProcessCount: 1, selectedProcessCount: 0 })
  })

  it('resolves the selected bundle symlink before comparing kernel image paths', async () => {
    const file = await executable(path.join(directory, 'selected.app/Contents/MacOS/Electron'))
    const alias = path.join(directory, 'unrelated-name.app')
    await fs.symlink(path.join(directory, 'selected.app'), alias, 'junction')
    target.appPath = path.join(alias, 'Contents/Resources/app.asar').replaceAll('\\', '/')
    mocks.paths.mockResolvedValue(new Map([[21, file]]))
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
  })

  it('uses all text images when the kernel executable was deleted, including a selected image after the first', async () => {
    mocks.images.mockResolvedValue([path.join(directory, 'old-other.app/deleted'), path.join(directory, 'selected.app/Contents/deleted')])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
  })

  it('retains a separate count for verified unrelated deleted executable images', async () => {
    mocks.images.mockResolvedValue([path.join(directory, 'other.app/deleted'), path.join(directory, 'other.app/another-deleted')])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ inspectedProcessCount: 1, kernelPathProcessCount: 0, textImageProcessCount: 1, selectedProcessCount: 0 })
  })

  it('checks every protected mapping without requiring access to its current filesystem path', async () => {
    const image = path.join(directory, 'other.app/protected/nested/image')
    denyImageResolution(image, path.dirname(image))
    mocks.images.mockResolvedValue([image])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ textImageProcessCount: 1, selectedProcessCount: 0 })
    const selected = path.join(directory, 'selected.app/Contents/deleted')
    mocks.images.mockResolvedValue([image, selected])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
    mocks.paths.mockResolvedValue(new Map([[21, image]]))
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ kernelPathProcessCount: 1, selectedProcessCount: 0 })
  })

  it.each(['executable', 'text'] as const)('rejects a live selected %s image whose deleted pathname now points outside', async (source) => {
    const image = await executable(path.join(directory, 'selected.app/Contents/MacOS/helper'))
    const outside = await executable(path.join(directory, 'other.app/helper'))
    await fs.unlink(image)
    await fs.symlink(outside, image, 'file')
    if (source === 'executable') {
      mocks.paths.mockResolvedValue(new Map([[21, image]]))
    }
    else {
      mocks.images.mockResolvedValue([image])
    }
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
  })

  it.each([{ images: [] }, { images: ['relative-name'] }, { images: ['invalid\npath'] }])('rejects incomplete or unresolvable text images %j', async ({ images }) => {
    mocks.images.mockResolvedValue(images)
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow()
  })

  it('does not treat a failed kernel lookup as proof that the process exited', async () => {
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('No complete text image inventory')
  })

  it('requires two matching zombie observations before excluding a non-running process', async () => {
    mocks.states.mockResolvedValue([{ ...state, zombie: true }])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ inspectedProcessCount: 0, zombieProcessCount: 1 })
    expect(mocks.images).not.toHaveBeenCalled()
    mocks.states.mockResolvedValueOnce([state])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('No complete text image inventory')
  })

  it('records exited processes only after an independent inventory no longer contains their PID', async () => {
    mocks.states.mockResolvedValueOnce([state]).mockResolvedValue([])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ inspectedProcessCount: 0, exitedProcessCount: 1 })
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it.each(['after-kernel', 'after-images'] as const)('refuses identity changes %s', async (stage) => {
    mocks.images.mockResolvedValue([path.join(directory, 'other.app/deleted')])
    mocks.states.mockResolvedValueOnce([state])
    if (stage === 'after-images') {
      mocks.states.mockResolvedValueOnce([state])
    }
    mocks.states.mockResolvedValue([{ ...state, started: 'different-process' }])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('process identity changed')
  })

  it('inspects a selected installation process that appeared after the first inventory', async () => {
    const newProcess = { ...state, pid: 22 }
    mocks.paths.mockResolvedValueOnce(new Map([[21, path.join(directory, 'other.app/host')]]))
    mocks.paths.mockResolvedValueOnce(new Map([[22, path.join(directory, 'selected.app/Contents/MacOS/host')]]))
    mocks.states.mockResolvedValueOnce([state]).mockResolvedValueOnce([state]).mockResolvedValue([state, newProcess])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
    expect(mocks.paths).toHaveBeenNthCalledWith(2, [22])
  })

  it('does not block on a transient new process that independently disappears', async () => {
    const transient = { ...state, pid: 22 }
    mocks.paths.mockResolvedValue(new Map([[21, path.join(directory, 'other.app/host')], [22, null]]))
    mocks.states.mockResolvedValueOnce([state]).mockResolvedValueOnce([state]).mockResolvedValueOnce([state, transient]).mockResolvedValue([state])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ inspectedProcessCount: 1, exitedProcessCount: 1 })
  })

  it('refuses continuing newly spawned processes instead of silently accepting an incomplete inventory', async () => {
    let pid = 21
    mocks.states.mockImplementation(async () => [{ ...state, pid: pid++ }])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('continuing new process activity')
  })

  it.each(['linux', 'win32'] as const)('refuses unverified %s inspection rather than falling back to process names', async (platform) => {
    await expect(inspectExitedWechatInstallation(target, platform)).rejects.toThrow('verified macOS process inventory')
    expect(mocks.states).not.toHaveBeenCalled()
  })
})
