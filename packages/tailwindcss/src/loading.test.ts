import { expect, it, vi } from 'vitest'

vi.mock('@weapp-tailwindcss/engine', () => {
  throw new Error('An inactive Tailwind adapter must not load the source engine')
})
vi.mock('weapp-tailwindcss/core', () => {
  throw new Error('An inactive Tailwind adapter must not load the compiler')
})

it('can import and dispose an unused adapter without loading optional compiler capabilities', async () => {
  const { createTailwindController } = await import('./index')
  const controller = createTailwindController()
  expect(await controller.invalidate(['unused.css'])).toEqual([])
  await controller.remove('unused.css')
  await controller.dispose()
  await controller.dispose()
})
