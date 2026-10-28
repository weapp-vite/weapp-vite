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

function denyImageResolution(code: 'EACCES' | 'EPERM', ...files: string[]) {
  const realpath = fs.realpath
  const denied = new Set(files.map(file => path.normalize(file)))
  vi.spyOn(fs, 'realpath').mockImplementation(async (file) => {
    if (denied.has(path.normalize(String(file)))) {
      throw Object.assign(new Error('Permission denied'), { code })
    }
    return realpath(file)
  })
}

function useInspectionClock() {
  const clock = { now: 0 }
  vi.spyOn(performance, 'now').mockImplementation(() => clock.now)
  return clock
}

function spawnGenerations(clock: { now: number }, lastGeneration: number) {
  let reads = 0
  mocks.states.mockImplementation(async () => {
    clock.now += 10
    const generation = Math.min(Math.floor(reads++ / 2), lastGeneration)
    return Array.from({ length: generation + 1 }, (_, index) => ({ ...state, pid: state.pid + index }))
  })
  mocks.paths.mockImplementation(async (pids: number[]) => new Map(pids.map(pid => [pid, path.join(directory, 'other.app/host')])))
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

  it.each(['EACCES', 'EPERM'] as const)('checks every mapping without depending on current filesystem permissions (%s)', async (code) => {
    const image = path.join(directory, 'other.app/protected/nested/image')
    denyImageResolution(code, image, path.dirname(image), path.join(directory, 'selected.app/Contents/deleted'))
    mocks.images.mockResolvedValue([image])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ textImageProcessCount: 1, selectedProcessCount: 0 })
    const selected = path.join(directory, 'selected.app/Contents/deleted')
    mocks.images.mockResolvedValue([image, selected])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
    mocks.paths.mockResolvedValue(new Map([[21, image]]))
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ kernelPathProcessCount: 1, selectedProcessCount: 0 })
    mocks.paths.mockResolvedValue(new Map([[21, selected]]))
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('still has a live process')
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

  it.each(['executable', 'text'] as const)('keeps an unrelated %s image unrelated after its pathname is replaced by a selected symlink', async (source) => {
    const image = await executable(path.join(directory, 'other.app/helper'))
    const selected = await executable(path.join(directory, 'selected.app/Contents/MacOS/helper'))
    await fs.unlink(image)
    await fs.symlink(selected, image, 'file')
    if (source === 'executable') {
      mocks.paths.mockResolvedValue(new Map([[21, image]]))
    }
    else {
      mocks.images.mockResolvedValue([image])
    }
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ inspectedProcessCount: 1, selectedProcessCount: 0 })
  })

  it.each([{ images: [] }, { images: ['relative-name'] }, { images: ['invalid\npath'] }])('rejects incomplete or unresolvable text images %j', async ({ images }) => {
    mocks.images.mockResolvedValue(images)
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow()
  })

  it('does not treat a failed kernel lookup as proof that the process exited', async () => {
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('No complete text image inventory')
  })

  it('independently verifies disappearance when a process exits during text-image sampling', async () => {
    mocks.states.mockResolvedValueOnce([state]).mockResolvedValueOnce([state]).mockResolvedValue([])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ inspectedProcessCount: 0, exitedProcessCount: 1 })
    expect(mocks.images).toHaveBeenCalledWith(state.pid, expect.any(Number))
  })

  it('rejects a reused PID when text-image sampling fails', async () => {
    mocks.states.mockResolvedValueOnce([state]).mockResolvedValueOnce([state]).mockResolvedValue([{ ...state, started: 'replacement' }])
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toThrow('process identity changed')
  })

  it('preserves sampling failure when the confirming process inventory is unavailable', async () => {
    mocks.states.mockResolvedValueOnce([state]).mockResolvedValueOnce([state]).mockRejectedValue(new Error('inventory denied'))
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toMatchObject({
      errors: [expect.objectContaining({ message: 'No complete text image inventory' }), expect.objectContaining({ message: 'inventory denied' })],
    })
  })

  it.each(['EACCES', 'EPERM'] as const)('rejects an unverifiable selected installation root (%s)', async (code) => {
    denyImageResolution(code, path.join(directory, 'selected.app'))
    await expect(inspectExitedWechatInstallation(target, 'darwin')).rejects.toMatchObject({ code })
    expect(mocks.states).not.toHaveBeenCalled()
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
    expect(mocks.paths).toHaveBeenNthCalledWith(2, [22], expect.any(Number))
  })

  it('does not block on a transient new process that independently disappears', async () => {
    const transient = { ...state, pid: 22 }
    mocks.paths.mockResolvedValue(new Map([[21, path.join(directory, 'other.app/host')], [22, null]]))
    mocks.states.mockResolvedValueOnce([state]).mockResolvedValueOnce([state]).mockResolvedValueOnce([state, transient]).mockResolvedValue([state])
    expect(await inspectExitedWechatInstallation(target, 'darwin')).toMatchObject({ inspectedProcessCount: 1, exitedProcessCount: 1 })
  })

  it('reconciles more than three process generations without omitting a newly observed PID', async () => {
    const clock = useInspectionClock()
    spawnGenerations(clock, 4)
    expect(await inspectExitedWechatInstallation(target, 'darwin', { timeoutMs: 1_000 })).toMatchObject({ inspectedProcessCount: 5, kernelPathProcessCount: 5, selectedProcessCount: 0 })
    expect(mocks.paths.mock.calls.map(([pids]) => pids)).toEqual([[21], [22], [23], [24], [25]])
    expect(mocks.images).not.toHaveBeenCalled()
  })

  it('refuses continuing process activity at the original deadline without extending its budget', async () => {
    const clock = useInspectionClock()
    spawnGenerations(clock, Number.POSITIVE_INFINITY)
    await expect(inspectExitedWechatInstallation(target, 'darwin', { timeoutMs: 100 })).rejects.toThrow('continuing new process activity')
    expect(clock.now).toBe(100)
    expect(mocks.paths).toHaveBeenCalledTimes(5)
    expect(mocks.states.mock.calls.map(([timeout]) => timeout)).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10])
  })

  it('rejects a selected process found after more than three generations before the deadline', async () => {
    const clock = useInspectionClock()
    spawnGenerations(clock, 4)
    mocks.paths.mockImplementation(async (pids: number[]) => new Map(pids.map(pid => [pid, path.join(directory, pid === 25 ? 'selected.app/Contents/MacOS/host' : 'other.app/host')])))
    await expect(inspectExitedWechatInstallation(target, 'darwin', { timeoutMs: 1_000 })).rejects.toThrow('still has a live process')
    expect(mocks.paths).toHaveBeenCalledTimes(5)
    expect(clock.now).toBeLessThan(1_000)
  })

  it('passes one diminishing budget through process, kernel and text-image sampling', async () => {
    const clock = useInspectionClock()
    mocks.states.mockImplementation(async () => {
      clock.now += 10
      return [state]
    })
    mocks.paths.mockImplementation(async () => {
      clock.now += 10
      return new Map([[21, null]])
    })
    mocks.images.mockImplementation(async () => {
      clock.now += 10
      return [path.join(directory, 'other.app/host')]
    })
    await inspectExitedWechatInstallation(target, 'darwin', { timeoutMs: 100 })
    expect(mocks.states.mock.calls.map(([timeout]) => timeout)).toEqual([100, 80, 60])
    expect(mocks.paths).toHaveBeenCalledWith([21], 90)
    expect(mocks.images).toHaveBeenCalledWith(21, 70)
  })

  it.each(['states', 'paths', 'images'] as const)('rejects %s results arriving after the deadline and dispatches no later sampling', async (phase) => {
    const clock = useInspectionClock()
    mocks.images.mockResolvedValue([path.join(directory, 'other.app/host')])
    mocks[phase].mockImplementationOnce(async () => {
      clock.now = 100
      return phase === 'states' ? [state] : phase === 'paths' ? new Map([[21, null]]) : [path.join(directory, 'other.app/host')]
    })
    await expect(inspectExitedWechatInstallation(target, 'darwin', { timeoutMs: 100 })).rejects.toThrow('deadline expired')
    expect(mocks.states).toHaveBeenCalledTimes(phase === 'images' ? 2 : 1)
    expect(mocks.paths).toHaveBeenCalledTimes(phase === 'states' ? 0 : 1)
    expect(mocks.images).toHaveBeenCalledTimes(phase === 'images' ? 1 : 0)
  })

  it('does not dispatch an initial inventory after installation resolution consumes the budget', async () => {
    const clock = useInspectionClock()
    const realpath = fs.realpath
    vi.spyOn(fs, 'realpath').mockImplementation(async (file) => {
      const result = await realpath(file)
      clock.now = 100
      return result
    })
    await expect(inspectExitedWechatInstallation(target, 'darwin', { timeoutMs: 100 })).rejects.toThrow('deadline expired')
    expect(mocks.states).not.toHaveBeenCalled()
  })

  it('retains the thirty-second inspection ceiling when a caller supplies a larger budget', async () => {
    const clock = useInspectionClock()
    mocks.states.mockImplementationOnce(async () => {
      clock.now = 30_000
      return [state]
    })
    await expect(inspectExitedWechatInstallation(target, 'darwin', { timeoutMs: 60_000 })).rejects.toThrow('deadline expired')
    expect(mocks.states).toHaveBeenCalledWith(30_000)
    expect(mocks.paths).not.toHaveBeenCalled()
  })

  it.each([0, -1, Number.NaN, 0.5, Number.POSITIVE_INFINITY])('rejects an invalid inspection budget before dispatch: %s', async (timeoutMs) => {
    await expect(inspectExitedWechatInstallation(target, 'darwin', { timeoutMs })).rejects.toThrow('positive process inventory timeout')
    expect(mocks.states).not.toHaveBeenCalled()
  })

  it.each(['linux', 'win32'] as const)('refuses unverified %s inspection rather than falling back to process names', async (platform) => {
    await expect(inspectExitedWechatInstallation(target, platform)).rejects.toThrow('verified macOS process inventory')
    expect(mocks.states).not.toHaveBeenCalled()
  })
})
