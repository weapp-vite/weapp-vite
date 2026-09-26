import { describe, expect, it } from 'vitest'
import { installationCommand } from '../src/installationCommand'

describe('registry installation hints', () => {
  it('keeps inherited configuration and common registry commands readable', () => {
    expect(installationCommand()).toBe('pnpm install')
    expect(installationCommand('https://registry.npmmirror.com/')).toBe('pnpm --config.registry=https://registry.npmmirror.com/ install')
  })

  it('quotes shell metacharacters without executing substitutions', () => {
    const registry = 'https://registry.example/$(command);it\'s/'
    expect(installationCommand(registry, 'linux')).toBe('pnpm --config.registry=\'https://registry.example/$(command);it\'\\\'\'s/\' install')
    expect(installationCommand(registry, 'win32')).toBe('PowerShell: pnpm --config.registry=\'https://registry.example/$(command);it\'\'s/\' install')
  })
})
