import { describe, expect, it } from 'vitest'
import { resolveProjectAutomatorPort } from './automator'

describe('automator session helpers', () => {
  it('derives a stable project scoped automator port', () => {
    const projectPath = '/workspace/templates/weapp-vite-template'

    const port = resolveProjectAutomatorPort(projectPath)

    expect(port).toBe(resolveProjectAutomatorPort(projectPath))
    expect(port).toBeGreaterThanOrEqual(9620)
    expect(port).toBeLessThan(11620)
  })

  it('derives different ports for different project roots when hashes differ', () => {
    const plainPort = resolveProjectAutomatorPort('/workspace/templates/weapp-vite-template')
    const libPort = resolveProjectAutomatorPort('/workspace/templates/weapp-vite-lib-template')

    expect(plainPort).not.toBe(libPort)
  })
})
