import { expect, it } from 'vitest'
import { runBabelConsumerProcess } from '../../../../../test/utils/babelBackendProcess'

it('does not start the Babel owner or Web backend when Web is disabled', async () => {
  const consumerUrl = new URL('./web.ts', import.meta.url).href
  const result = await runBabelConsumerProcess(`
    const { mergeWeb } = await import(${JSON.stringify(consumerUrl)})
    const baselineCore = countCore()
    const options = {
      config: {}, mode: 'production', isDev: false,
      applyRuntimePlatform() { throw new Error('disabled Web changed runtime') },
      injectBuiltinAliases() { throw new Error('disabled Web changed aliases') },
      getDefineImportMetaEnv() { throw new Error('disabled Web evaluated configuration') },
    }
    const missing = mergeWeb({ ...options, web: undefined })
    const disabled = mergeWeb({ ...options, web: { enabled: false } })
    process.stdout.write(JSON.stringify({
      missing: missing === undefined, disabled: disabled === undefined,
      addedCore: countCore() - baselineCore, owner: countOwner(), backend: countBackend('@weapp-vite/web/plugin'),
    }))
  `)

  expect(result).toEqual({ missing: true, disabled: true, addedCore: 0, owner: 0, backend: 0 })
})
