import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { nativeSlotScopeFiles } from '../test/helpers/nativeSlotScopes'

it('renders and queries native slot children in their declaring scopes', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(nativeSlotScopeFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)

  async function assertScopes(owner: string, labels: string[]) {
    const tree = session.renderCurrentPage()
    preview.innerHTML = tree.wxml
    const probe = preview.querySelectorAll('#plain-host > .native-slot-frame > block > #plain .probe-value')
    expect(probe).toHaveLength(1)
    expect(probe[0]?.textContent).toBe(owner)
    expect(preview.querySelectorAll('#list-host .row-list > .row-item')).toHaveLength(labels.length)
    expect([...preview.querySelectorAll('#list-host .row-label')].map(node => node.textContent)).toEqual(labels)
    for (const label of labels) {
      const projected = preview.querySelectorAll(`#list-host #item-${label} > .native-slot-frame > block > #${label}`)
      expect(projected).toHaveLength(1)
      expect(projected[0]?.textContent).toBe(label)
    }

    const pageRoot = new HeadlessTestingNodeHandle(tree.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: scopeId => scopeId ? session.getScopeIdForComponent(session.selectOwnerComponent(scopeId)) : null,
    })
    const page = (await pageRoot.$('page'))!
    expect(await page.$$('.probe-value')).toHaveLength(0)
    const plainHost = (await page.$('#plain-host'))!
    expect(await plainHost.$$('#plain')).toHaveLength(0)
    const plain = (await page.$('#plain'))!
    expect(await (await plain.$('.probe-value'))!.text()).toBe(owner)
    const listHost = (await page.$('#list-host'))!
    const generics = await listHost.$$('component')
    expect(generics).toHaveLength(1)
    expect(await Promise.all((await generics[0]!.$$('.row-label')).map(node => node.text()))).toEqual(labels)
    for (const label of labels) {
      const item = (await generics[0]!.$(`#item-${label}`))!
      expect(await item.$$(`#${label}`)).toHaveLength(0)
    }
  }

  try {
    const page = session.reLaunch('/pages/index/index')
    await assertScopes('owner value', ['first', 'second', 'third'])
    page.setData({ owner: 'updated owner', labels: ['second', 'fourth'] })
    await assertScopes('updated owner', ['second', 'fourth'])
    expect(preview.querySelectorAll('#first, #third')).toHaveLength(0)
  }
  finally {
    session.close()
    preview.remove()
  }
})
