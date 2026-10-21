import assert from 'node:assert/strict'
import { it } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../weapp-ide-cli/src/index'
import { scenarios } from './probe/scenarios.mjs'
import { ordinaryEnvironment } from './supervisor.mjs'

it('polling 能力覆盖继承的 Chokidar 环境，其他场景继续使用原生 watcher', () => {
  const inherited = { CHOKIDAR_USEPOLLING: 'false', CHOKIDAR_INTERVAL: '5000' }
  const original = { ...inherited }
  for (const scenario of scenarios) {
    const environment = ordinaryEnvironment({}, inherited, scenario)
    assert.equal(environment.CHOKIDAR_USEPOLLING, scenario.polling ? 'true' : 'false')
    assert.equal(environment.CHOKIDAR_INTERVAL, scenario.polling ? '100' : '5000')
  }
  assert.deepEqual(inherited, original)
})

it('默认安装和类型检查环境拒绝继承外部 polling 选择', () => {
  const environment = ordinaryEnvironment({}, { CHOKIDAR_USEPOLLING: 'true' })
  assert.equal(environment.CHOKIDAR_USEPOLLING, 'false')
})

it('显式 polling worker 仍只继承能力 scope，不继承真实 IDE journal 或源码解析别名', () => {
  const inherited = { [MANAGED_PROJECT_JOURNAL_ENV]: 'outer-ide-journal', NODE_OPTIONS: '--conditions=source', NODE_PATH: 'source-alias', CAPABILITY: 'outer' }
  const scope = { CAPABILITY: 'worker', CHOKIDAR_USEPOLLING: 'false', CHOKIDAR_INTERVAL: '9000' }
  const environment = ordinaryEnvironment(scope, inherited, { polling: true })
  assert.deepEqual(environment, { CAPABILITY: 'worker', CHOKIDAR_USEPOLLING: 'true', CHOKIDAR_INTERVAL: '100' })
  assert.equal(inherited[MANAGED_PROJECT_JOURNAL_ENV], 'outer-ide-journal')
  assert.equal(scope.CHOKIDAR_USEPOLLING, 'false')
})
