import { describe, expect, it } from 'vitest'
import {
  CONFIG_COMMAND_NAME,
  isWeappIdeTopLevelCommand,
  MINIDEV_NAMESPACE_COMMAND_NAMES,
  WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES,
  WECHAT_CLI_COMMAND_NAMES,
} from '../src/cli/command-catalog'
import { AUTOMATOR_COMMAND_NAMES } from '../src/cli/run-automator'

describe('command catalog', () => {
  it('contains all wechat official command entries', () => {
    expect(WECHAT_CLI_COMMAND_NAMES).toContain('preview')
    expect(WECHAT_CLI_COMMAND_NAMES).toContain('upload')
    expect(WECHAT_CLI_COMMAND_NAMES).toContain('cloud')
  })

  it('contains all automator command entries', () => {
    for (const command of AUTOMATOR_COMMAND_NAMES) {
      expect(WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES).toContain(command)
    }
  })

  it('contains config and minidev namespace entries', () => {
    expect(WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES).toContain(CONFIG_COMMAND_NAME)
    for (const command of MINIDEV_NAMESPACE_COMMAND_NAMES) {
      expect(WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES).toContain(command)
    }
  })

  it('can identify whether a top-level command is supported', () => {
    expect(isWeappIdeTopLevelCommand('navigate')).toBe(true)
    expect(isWeappIdeTopLevelCommand('config')).toBe(true)
    expect(isWeappIdeTopLevelCommand('unknown-cmd')).toBe(false)
    expect(isWeappIdeTopLevelCommand(undefined)).toBe(false)
  })
})
