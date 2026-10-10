import { describe, expect, it } from 'vitest'
import { splitWechatDevtoolsSelectionArgs } from '../src/cli/devtoolsSelection'

describe('DevTools wrapper parameters', () => {
  it('removes wrapper flags while keeping the native upload version', () => {
    expect(splitWechatDevtoolsSelectionArgs(['upload', '--version', '1.2.3', '--devtools-version=2.02.2608080', '--devtools-channel', 'rc', '--cli-path', 'C:/微信 开发者工具/cli.bat', '--require-official-latest'])).toEqual({ args: ['upload', '--version', '1.2.3'], selection: { devtoolsVersion: '2.02.2608080', devtoolsChannel: 'rc', cliPath: 'C:/微信 开发者工具/cli.bat', requireOfficialLatest: true } })
  })
  it('preserves literal option values and content after the argument boundary', () => {
    expect(splitWechatDevtoolsSelectionArgs(['upload', '--desc', '--devtools-channel=rc', '--', '--devtools-channel=nightly'])).toEqual({ args: ['upload', '--desc', '--devtools-channel=rc', '--', '--devtools-channel=nightly'], selection: {} })
  })
  it.each([
    ['--devtools-channel=stable', '--devtools-channel=nightly'],
    ['--devtools-version=2.02.1', '--devtools-version=2.02.2'],
    ['--cli-path=first', '--cli-path=second'],
    ['--require-official-latest', '--require-official-latest=false'],
  ])('rejects conflicting repeated selectors %j', (...args) => {
    expect(() => splitWechatDevtoolsSelectionArgs(args)).toThrow('Conflicting')
  })
  it('permits repeated equivalent values', () => {
    expect(splitWechatDevtoolsSelectionArgs(['--devtools-channel=stable', '--devtools-channel', 'stable']).selection).toEqual({ devtoolsChannel: 'stable' })
  })
  it.each([['--devtools-channel'], ['--devtools-channel=unknown'], ['--devtools-version=latest'], ['--require-official-latest=maybe']])('rejects invalid selectors %j', (args) => {
    expect(() => splitWechatDevtoolsSelectionArgs([args])).toThrow()
  })
})
