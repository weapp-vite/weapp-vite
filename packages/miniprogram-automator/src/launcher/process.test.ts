import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OperationLifecycle } from '../operation'
import { spawnWechatCli } from './process'

const spawnMock = vi.hoisted(() => vi.fn())
vi.mock('node:child_process', () => ({ spawn: spawnMock }))

function createChild() {
  const child = Object.assign(new EventEmitter(), {
    pid: process.pid,
    exitCode: null as number | null,
    signalCode: null as string | null,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    unref: vi.fn(),
    kill: vi.fn((_signal: string) => {
      child.signalCode = 'SIGKILL'
      child.emit('exit', null, 'SIGKILL')
      child.emit('close')
      return true
    }),
  })
  return child
}

afterEach(() => vi.restoreAllMocks())

describe('CLI process ownership', () => {
  it('releases only its own child once while preserving a manual host, another project and another installation', async () => {
    const manualHost = createChild()
    const owned = createChild()
    const otherProject = createChild()
    const otherInstallation = createChild()
    spawnMock.mockReset().mockReturnValueOnce(otherProject).mockReturnValueOnce(otherInstallation).mockReturnValueOnce(owned)
    const killByPid = vi.spyOn(process, 'kill')
    const owner = new OperationLifecycle(1000, 'owner')
    const peer = new OperationLifecycle(1000, 'peer')
    const installation = new OperationLifecycle(1000, 'installation')
    spawnWechatCli('stable-cli', ['--project', 'other-project'], '', peer)
    spawnWechatCli('alternate-cli', ['--project', 'project'], '', installation)
    // 每个返回句柄明确归属于创建它的 scope，与项目名或安装名无关。
    const failure = new Error('launch failed')
    let state: ReturnType<typeof spawnWechatCli>
    await expect(owner.run(async () => {
      state = spawnWechatCli('stable-cli', ['--project', 'project'], '', owner)
      throw failure
    })).rejects.toBe(failure)
    await state!.release()
    await state!.release()
    expect(owned.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(otherInstallation.kill).not.toHaveBeenCalled()
    expect(otherProject.kill).not.toHaveBeenCalled()
    expect(manualHost.kill).not.toHaveBeenCalled()
    expect(killByPid).not.toHaveBeenCalled()
    expect(owner.diagnostics.cleanup).toEqual([{ resource: 'cli-process', status: 'released' }])
  })

  it('does not kill an exited CLI even if its old PID is reused by a host', async () => {
    const child = createChild()
    spawnMock.mockReset().mockReturnValue(child)
    const scope = new OperationLifecycle(1000, 'exited')
    const state = spawnWechatCli('cli', [], '', scope)
    child.exitCode = 0
    child.emit('exit', 0, null)
    await state.release()
    await expect(scope.run(async () => {
      throw new Error('later failure')
    })).rejects.toThrow('later failure')
    expect(child.kill).not.toHaveBeenCalled()
    expect(scope.diagnostics.cleanup).toEqual([])
  })
})
