import { initDevframe } from 'devframe/initiate'
import { expect, it } from 'vitest'
import { createAnalyzeDashboardDevframe } from '../../dashboard'
import { withStandaloneDashboardPolicy } from './dashboardPolicy'

it('rejects global shared-state mutations before the standalone dashboard admits reads', async () => {
  const controller = createAnalyzeDashboardDevframe({
    snapshot: {
      current: {
        packages: [],
        modules: [],
        subPackages: [],
        glassEasel: {
          detected: false,
          minimumBaseLibrary: '3.8.12',
          migrationGuide: '',
          diagnostics: [],
          summary: { errors: 0, warnings: 0 },
        },
      },
      previous: null,
      artifacts: new Map(),
    },
    roots: {},
  })
  const instance = initDevframe(withStandaloneDashboardPolicy(controller.definition), {
    auth: false,
    base: '/',
    sse: false,
    ws: false,
  })
  try {
    await instance.ready
    const context = await instance.context
    const dashboard = context.scope('weapp-vite')
    await expect(dashboard.rpc.call('devframe:rpc:server-state:set', 'weapp-vite:dashboard', { revision: 999 }, 'malicious-set'))
      .rejects
      .toThrow('只允许服务端修改')
    await expect(dashboard.rpc.call('devframe:rpc:server-state:patch', 'weapp-vite:dashboard', [{ op: 'replace', path: ['revision'], value: 999 }], 'malicious-patch'))
      .rejects
      .toThrow('只允许服务端修改')
    expect(context.rpc.sharedState.keys()).not.toContain('weapp-vite:dashboard')
    await expect(dashboard.rpc.call('get-dashboard-state')).resolves.toMatchObject({ revision: 0 })
  }
  finally {
    controller.dispose()
    await instance.close()
  }
})
