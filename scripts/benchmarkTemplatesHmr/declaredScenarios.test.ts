import { expect, it } from 'vitest'
import { mutateDeclaredSource, parseDeclaredScenarios } from './declaredScenarios'

it('rejects escaping paths, unknown mutations and duplicate scenario ids', () => {
  const row = { id: 'plain', source: 'pages/index.wxss', output: 'pages/index.wxss', mutation: 'style' }
  expect(parseDeclaredScenarios([row])).toEqual([row])
  for (const invalid of [{ ...row, source: '../outside' }, { ...row, mutation: 'execute' }, { ...row, mutation: 'route' }]) {
    expect(() => parseDeclaredScenarios([invalid])).toThrow()
  }
  expect(() => parseDeclaredScenarios([row, row])).toThrow('duplicate')
})

it('changes topology without destroying existing routes or component declarations', () => {
  const rows = parseDeclaredScenarios([
    { id: 'route', source: 'app.json', output: 'app.json', mutation: 'route', target: 'pages/optional/index' },
    { id: 'component', source: 'pages/index.json', output: 'pages/index.json', mutation: 'component', target: 'components/optional/index' },
  ])
  expect(JSON.parse(mutateDeclaredSource(rows[0]!, '{"pages":["pages/home/index"]}', 'marker'))).toEqual({ pages: ['pages/home/index', 'pages/optional/index'] })
  expect(JSON.parse(mutateDeclaredSource(rows[1]!, '{"usingComponents":{"existing":"/components/existing"}}', 'marker'))).toEqual({ usingComponents: { existing: '/components/existing', marker: '/components/optional/index' } })
})
