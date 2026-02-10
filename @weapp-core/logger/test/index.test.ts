import picocolors from 'picocolors'
import logger, { colors } from '@/index'

describe('logger', () => {
  it('should expose logger instance', () => {
    expect(logger).toBeDefined()
  })

  it('should expose shared picocolors instance', () => {
    expect(colors).toBe(picocolors)
    expect(typeof colors.green).toBe('function')
  })
})
