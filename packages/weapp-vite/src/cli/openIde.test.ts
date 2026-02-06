import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseMock = vi.hoisted(() => vi.fn())

vi.mock('weapp-ide-cli', () => ({
  parse: parseMock,
}))

describe('openIde', () => {
  beforeEach(() => {
    parseMock.mockReset()
    parseMock.mockResolvedValue(undefined)
  })

  it('passes project path and alipay platform to weapp-ide-cli parse', async () => {
    const { openIde } = await import('./openIde')
    await openIde('alipay', 'dist/alipay')

    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/alipay',
      '--platform',
      'alipay',
    ])
  })

  it('does not append platform for non-alipay', async () => {
    const { openIde } = await import('./openIde')
    await openIde('weapp', 'dist/dev/mp-weixin')

    expect(parseMock).toHaveBeenCalledWith([
      'open',
      '-p',
      'dist/dev/mp-weixin',
    ])
  })
})
