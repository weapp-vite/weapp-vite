import { expect } from 'vitest'

export interface PropertyDeliveryEvent {
  event: string
  args: unknown[]
  properties: Record<string, unknown>
  data: Record<string, unknown>
  sameDataAndProperties: boolean
}

export function assertPropertyDeliveryEvents(events: PropertyDeliveryEvent[], stage: 'initial' | 'updated' | 'self-written') {
  expect(events.length).toBeGreaterThan(0)
  for (const event of events) {
    expect(event.sameDataAndProperties, event.event).toBe(true)
    expect(event.properties, event.event).toEqual(event.data)
    expect(event.data.local, event.event).toBe('local-data')
    expect(event.properties, event.event).not.toHaveProperty('extra')
    expect(event.properties, event.event).not.toHaveProperty('id')
  }
  const firstChanges: unknown[][] = [['OWNER', '']]
  if (stage !== 'initial') {
    firstChanges.push(['OWNER-UPDATED', 'OWNER'])
  }
  if (stage === 'self-written') {
    firstChanges.push(['SELF-CHANGED', 'SELF'])
  }
  expect(events.filter(event => event.event === 'first').map(event => event.args.slice(0, 2))).toEqual(firstChanges)
  expect(events.filter(event => event.event === 'first').map(event => event.args[2])).toEqual(firstChanges.map(() => ['first']))
  const initialFirst = events.find(event => event.event === 'data:first')!
  expect(initialFirst.data).toMatchObject({ first: 'OWNER', second: ['value', 'SLOT-READY'] })
  const firstPropertyIndex = events.findIndex(event => event.event === 'first')
  expect(events.findIndex(event => event.event === 'data:first,second')).toBeLessThan(firstPropertyIndex)
  if (stage === 'self-written') {
    expect(events.find(event => event.event === 'self:direct-data')?.properties.first).toBe('SELF')
    const selfStart = events.findIndex(event => event.event === 'self:before')
    const selfEvents = events.slice(selfStart)
    expect(selfEvents.filter(event => event.event === 'data:first').map(event => event.args[0])).toEqual([
      'SELF',
      'SELF',
      'SELF-CHANGED',
    ])
    expect(selfEvents.filter(event => event.event.endsWith(':callback'))).toHaveLength(3)
  }
}
