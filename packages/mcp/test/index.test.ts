import { createHash } from 'node:crypto'

describe('index', () => {
  it('foo bar', () => {
    const base64String = createHash('sha512').update('').digest('base64')
    console.log(base64String)
    expect(base64String).toBe('z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==')
  })
})
