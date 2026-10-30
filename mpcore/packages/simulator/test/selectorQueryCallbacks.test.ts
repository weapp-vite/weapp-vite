import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { executeSelectorQueryRequests } from '../src/view/selectorQuery'
import { nativeSelectorAttachmentFiles } from './helpers/nativeSelectorAttachment'

it('preserves request positions, freezes each callback batch and cancels callbacks on close', async () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-selector-callbacks-'))
  for (const [file, source] of nativeSelectorAttachmentFiles) {
    const target = path.join(projectPath, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, file === 'pages/index/index.wxml'
      ? source.replace('<query-leaf id="visible-regular"', '<query-leaf wx:if="{{!removeVisible}}" id="visible-regular"')
      : source)
  }
  const session = createHeadlessSession({ projectPath })
  try {
    const page = session.reLaunch('/pages/index/index')
    const events: unknown[] = []
    const query = session.getWx().createSelectorQuery().in(page.selectComponent!('#visible-regular'))
    query.select('.query-missing').fields({ id: true })
    query.select('.query-root').fields({ id: true }, value => events.push(['root', value && !Array.isArray(value) ? value.id : null]))
    const immediate = query.exec(results => events.push(['exec', results.length]))
    expect(immediate).toEqual([null, { id: 'visible-regular' }])
    expect(events).toEqual([])
    query.select('.query-missing').fields({ id: true }, value => events.push(['late', value]))
    await Promise.resolve()
    expect(events).toEqual([['root', 'visible-regular'], ['exec', 2]])

    const nested = session.getWx().createSelectorQuery().in(page.selectComponent!('#visible-regular'))
    const nestedEvents: unknown[] = []
    nested.select('.query-root').fields({ id: true }, value => nestedEvents.push(value))
    const render = session.renderCurrentPage.bind(session)
    session.renderCurrentPage = () => {
      nested.select('.query-missing').fields({ id: true }, value => nestedEvents.push(['appended', value]))
      return render()
    }
    try {
      expect(nested.exec()).toEqual([{ id: 'visible-regular' }])
      await Promise.resolve()
      expect(nestedEvents).toEqual([{ id: 'visible-regular' }])
    }
    finally {
      session.renderCurrentPage = render
    }

    const owner = page.selectComponent!('#visible-regular')
    page.setData({ removeVisible: true })
    expect(owner.createSelectorQuery().select('.query-root').fields({ id: true }).exec()).toEqual([null])

    query.exec(() => events.push('closed-exec'))
    session.close()
    await Promise.resolve()
    expect(events).toEqual([['root', 'visible-regular'], ['exec', 2]])
  }
  finally {
    session.close()
    fs.rmSync(projectPath, { recursive: true, force: true })
  }
})

it('returns missing results instead of querying a sibling when the requested scope is absent', () => {
  expect(executeSelectorQueryRequests([
    { target: 'selector', selector: '.query-root', single: true, fields: { id: true } },
    { target: 'selector', selector: '.query-root', single: false, fields: { id: true } },
  ], {
    page: {} as never,
    windowInfo: {} as never,
    root: { type: 'root', children: [{ type: 'tag', name: 'view', attribs: { 'class': 'query-root', 'id': 'sibling', 'data-sim-scope': 'sibling' } }] },
    scopeId: 'removed',
  })).toEqual([null, []])
})
