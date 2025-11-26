import { getDefaultTsDts } from '@/tsDts'

describe('tsDts', () => {
  it('getDefaultTsDts', () => {
    const content = getDefaultTsDts()
    expect(content.trim()).toBe('/// <reference types="weapp-vite/client" />')
    expect(content.endsWith('\n')).toBe(true)
  })
})
