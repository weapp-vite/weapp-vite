import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createStoreDefinitionReloadFiles, storeDefinitionApp, updatedStoreName } from './helpers/storeDefinitionReload'

it('keeps existing Pinia definitions until a fresh App installs the updated Store', async () => {
  const files = createBrowserVirtualFiles(await createStoreDefinitionReloadFiles())
  const initial = createBrowserHeadlessSession({ files })
  try {
    expect(initial.reLaunch('/pages/initial/index').data).toMatchObject({ name: 'init', plugin: true })
    // 新定义不会静默替换活动 Pinia 中已有的实例，页面导航也不等于 App 重启。
    expect(initial.reLaunch('/pages/updated/index').data).toMatchObject({ name: 'init', plugin: false })
  }
  finally {
    initial.close()
  }
  files.set('app.js', storeDefinitionApp('updated'))
  const restarted = createBrowserHeadlessSession({ files })
  try {
    expect(restarted.reLaunch('/pages/updated/index').data).toMatchObject({ name: updatedStoreName, plugin: true })
    expect(restarted.reLaunch('/pages/updated/index').data).toMatchObject({ name: updatedStoreName, plugin: true })
  }
  finally {
    restarted.close()
  }
})
