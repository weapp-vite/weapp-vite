/* eslint-disable antfu/no-top-level-await -- Compile-only public API contract. */
import type { AcceptanceOptions, AcceptanceReport, RuntimeConnector, Scenario } from '@weapp-vite/acceptance'
import { AcceptanceService, loadAcceptanceConfig, scenarioSchema } from '@weapp-vite/acceptance'
import { expectType } from 'tsd'

declare const connect: RuntimeConnector
const options: AcceptanceOptions = { connect, configFile: 'acceptance.json', trust: false }
const service = await AcceptanceService.create('.', options)
expectType<AcceptanceReport>(await service.start())
expectType<AcceptanceReport>(await service.wait('job'))
expectType<AcceptanceReport>(await service.report('job'))
expectType<AcceptanceReport>(await service.cancel('job'))
expectType<void>(await service.close())
expectType<Scenario>(scenarioSchema.parse({ version: 1, name: 'counter', steps: [] }))
const config = await loadAcceptanceConfig('.')
expectType<1 | undefined>(config?.version)
if (config) {
  expectType<1>(config.version)
}
