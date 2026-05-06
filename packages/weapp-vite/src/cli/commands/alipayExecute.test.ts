import { beforeEach, describe, expect, it, vi } from 'vitest'

function createChildProcess(exitCode: number) {
  return {
    on(event: string, handler: (...args: any[]) => void) {
      if (event === 'exit') {
        queueMicrotask(() => {
          handler(exitCode)
        })
      }
      return this
    },
  } as any
}

describe('alipay minidev execute', () => {
  const spawnMock = vi.fn()

  beforeEach(() => {
    spawnMock.mockReset()
  })

  it('spawns minidev with inherited stdio', async () => {
    spawnMock.mockReturnValueOnce(createChildProcess(0))
    const { runSpawnMinidev } = await import('./alipayExecute')

    await runSpawnMinidev('minidev', ['preview'], spawnMock)

    expect(spawnMock).toHaveBeenCalledWith('minidev', ['preview'], {
      shell: process.platform === 'win32',
      stdio: 'inherit',
    })
  })

  it('rejects non-zero exit code', async () => {
    spawnMock.mockReturnValueOnce(createChildProcess(1))
    const { runSpawnMinidev } = await import('./alipayExecute')

    await expect(runSpawnMinidev('minidev', ['upload'], spawnMock)).rejects.toThrow('minidev upload exited with code 1')
  })
})
