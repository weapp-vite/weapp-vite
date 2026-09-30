import { describe, expect, it } from 'vitest'
import { settleBuildTasks } from './buildTasks'

describe('parallel build lifetime', () => {
  it('does not return a compiler failure while npm is still writing', async () => {
    const compilerError = new Error('invalid syntax')
    const copy = Promise.withResolvers<void>()
    let finished = false
    const result = settleBuildTasks(Promise.reject(compilerError), [copy.promise])
      .catch((error: unknown) => {
        finished = true
        return error
      })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(finished).toBe(false)
    copy.resolve()
    expect(await result).toBe(compilerError)
  })
  it('observes an early auxiliary failure while allowing the bundler to finish', async () => {
    const bundler = Promise.withResolvers<string>()
    const npmError = new Error('npm failed')
    let finished = false
    const result = settleBuildTasks(bundler.promise, [Promise.reject(npmError)])
      .catch((error: unknown) => {
        finished = true
        return error
      })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(finished).toBe(false)
    bundler.resolve('bundle')
    expect(await result).toBe(npmError)
  })
  it('drains secondary failures without replacing the primary diagnostic', async () => {
    const compilerError = new Error('invalid syntax')
    await expect(settleBuildTasks(Promise.reject(compilerError), [Promise.reject(new Error('copy failed'))])).rejects.toBe(compilerError)
    await expect(settleBuildTasks(Promise.resolve('bundle'), [Promise.resolve()])).resolves.toBe('bundle')
  })
})
