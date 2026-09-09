import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { resolveTestingPagePath } from '../src/testing/pagePath'
import { pluginProtocolFiles } from '../test/helpers/pluginProtocol'

it('renders plugin page content and updates while preserving its protocol path and internal route', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(pluginProtocolFiles('__plugins__/hello')) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const host = session.reLaunch('/pages/index/index')
    render()
    expect(preview.querySelector('#host-title')?.textContent).toBe('Plugin host')
    expect(preview.querySelector('#meter-value')?.textContent).toBe('78%')
    expect(resolveTestingPagePath(host.route)).toBe('pages/index/index')

    const page = session.navigateTo('plugin://hello/hello-page?source=host')
    render()
    expect(page.route).toBe('plugin-private://wxpluginprovider/pages/hello/index')
    expect(resolveTestingPagePath(page.route)).toBe('__plugin__/wxpluginprovider/pages/hello/index')
    expect(page.options).toEqual({ source: 'host' })
    expect(preview.querySelectorAll('#plugin-title')).toHaveLength(1)
    expect(preview.querySelector('#plugin-title')?.textContent).toBe('Plugin page')
    expect([...preview.querySelectorAll('.plugin-card')].map(node => node.textContent)).toEqual(['Vue SFC', 'Native components', 'Styles', 'Navigation'])
    expect(preview.querySelector('#meter-label')?.textContent).toBe('Plugin score')
    expect(preview.querySelector('#meter-value')?.textContent).toBe('94%')
    const button = preview.querySelector('#increment')!
    session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, {})
    render()
    expect(preview.querySelector('#meter-value')?.textContent).toBe('100%')
    expect(resolveTestingPagePath(session.getCurrentPages().at(-1)!.route)).toBe('__plugin__/wxpluginprovider/pages/hello/index')

    session.navigateBack()
    render()
    expect(session.getCurrentPages().at(-1)).toBe(host)
    expect(preview.querySelector('#host-title')?.textContent).toBe('Plugin host')
    expect(preview.querySelector('#plugin-title')).toBeNull()
    expect(preview.querySelector('#meter-value')?.textContent).toBe('78%')
  }
  finally {
    session.close()
    preview.remove()
  }
})
