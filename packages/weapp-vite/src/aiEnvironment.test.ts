import { beforeEach, describe, expect, it, vi } from 'vitest'

const determineAgentMock = vi.hoisted(() => vi.fn())

vi.mock('@vercel/detect-agent', () => ({
  determineAgent: determineAgentMock,
}))

describe('ai environment detection', () => {
  beforeEach(() => {
    vi.resetModules()
    determineAgentMock.mockReset()
    determineAgentMock.mockResolvedValue({
      isAgent: false,
      agent: undefined,
    })
  })

  it('detects agent name with @vercel/detect-agent', async () => {
    determineAgentMock.mockResolvedValue({
      isAgent: true,
      agent: {
        name: 'codex',
      },
    })
    const { detectAiDevelopmentEnvironment } = await import('./aiEnvironment')

    await expect(detectAiDevelopmentEnvironment({})).resolves.toEqual({
      agentName: 'codex',
      isAgent: true,
    })
  })

  it('keeps explicit weapp-vite env override as fallback', async () => {
    const { detectAiDevelopmentEnvironment } = await import('./aiEnvironment')

    await expect(detectAiDevelopmentEnvironment({
      WEAPP_VITE_AI: 'custom-agent',
    })).resolves.toEqual({
      agentName: 'custom-agent',
      isAgent: true,
    })
    expect(determineAgentMock).not.toHaveBeenCalled()
  })
})
