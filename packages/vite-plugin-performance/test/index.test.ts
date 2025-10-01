import type { Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLUGIN_HOOKS } from '@/constants'
import { wrapPlugin } from '@/wrapPlugin'

function createTimelineClock(values: number[]) {
  let index = 0
  const lastIndex = values.length - 1
  return () => {
    const value = values[index] ?? values[lastIndex]
    if (index < lastIndex) {
      index += 1
    }
    return value
  }
}

describe('wrapPlugin', () => {
  it('wraps a single plugin and reports execution', async () => {
    const clock = createTimelineClock([0, 42])
    const logger = vi.fn()
    const onHookExecution = vi.fn()

    const plugin: Plugin = {
      name: 'test-plugin',
      async transform(code: string) {
        return code
      },
    }

    const wrapped = wrapPlugin(plugin, {
      threshold: 10,
      logger,
      onHookExecution,
      clock,
    })

    await wrapped.transform?.call({}, 'code', 'id')

    expect(logger).toHaveBeenCalledTimes(1)
    const [message, context] = logger.mock.calls[0]
    expect(message).toContain('test-plugin')
    expect(message).toContain('transform')
    expect(context.duration).toBe(42)
    expect(onHookExecution).toHaveBeenCalledWith(expect.objectContaining({
      pluginName: 'test-plugin',
      hookName: 'transform',
      duration: 42,
    }))
  })

  it('does not log when below threshold', async () => {
    const clock = createTimelineClock([0, 5])
    const logger = vi.fn()

    const plugin: Plugin = {
      name: 'threshold-plugin',
      transform(code: string) {
        return code
      },
    }

    const wrapped = wrapPlugin(plugin, {
      threshold: 10,
      logger,
      clock,
    })

    await wrapped.transform?.call({}, 'code', 'id')
    expect(logger).not.toHaveBeenCalled()
  })

  it('respects silent option', async () => {
    const clock = createTimelineClock([0, 30])
    const logger = vi.fn()

    const plugin: Plugin = {
      name: 'silent-plugin',
      buildStart() {
        return undefined
      },
    }

    const wrapped = wrapPlugin(plugin, {
      hooks: ['buildStart'],
      silent: true,
      logger,
      clock,
    })

    await wrapped.buildStart?.call({}, {})
    expect(logger).not.toHaveBeenCalled()
  })

  it('handles asynchronous hooks', async () => {
    let time = 0
    const clock = () => time
    const logger = vi.fn()

    const plugin: Plugin = {
      name: 'async-plugin',
      async load() {
        time = 25
        await Promise.resolve()
        time = 80
        return null
      },
    }

    const wrapped = wrapPlugin(plugin, {
      hooks: ['load'],
      threshold: 10,
      logger,
      clock,
    })

    await wrapped.load?.call({}, 'id')
    expect(logger).toHaveBeenCalledTimes(1)
    const [, context] = logger.mock.calls[0]
    expect(context.duration).toBe(80)
  })

  it('wraps every function when hooks is set to "all"', async () => {
    const clock = createTimelineClock([0, 15])
    const logger = vi.fn()

    const plugin = {
      name: 'all-hooks',
      transform: (code: string) => code,
      customHook: () => null,
    } as Plugin

    const wrapped = wrapPlugin(plugin, {
      hooks: 'all',
      threshold: 10,
      logger,
      clock,
    })

    await wrapped.customHook?.call({}, {})
    expect(logger).toHaveBeenCalledTimes(1)
  })

  it('wraps an array of plugins', async () => {
    const clock = createTimelineClock([0, 20, 0, 25])
    const logger = vi.fn()

    const plugins: Plugin[] = [
      {
        name: 'first',
        load: () => null,
      },
      {
        name: 'second',
        load: () => null,
      },
    ]

    const wrapped = wrapPlugin(plugins, {
      hooks: ['load'],
      threshold: 10,
      logger,
      clock,
    })

    await wrapped[0].load?.call({}, 'a')
    await wrapped[1].load?.call({}, 'b')
    expect(logger).toHaveBeenCalledTimes(2)
  })

  it('falls back to anonymous plugin name when missing', async () => {
    const clock = createTimelineClock([0, 12])
    const logger = vi.fn()

    const plugin = {
      transform: (code: string) => code,
    } as Plugin

    const wrapped = wrapPlugin(plugin, {
      hooks: DEFAULT_PLUGIN_HOOKS,
      threshold: 10,
      logger,
      clock,
    })

    await wrapped.transform?.call({}, 'code', 'id')
    const [message] = logger.mock.calls[0]
    expect(message).toContain('anonymous-plugin')
  })
})
