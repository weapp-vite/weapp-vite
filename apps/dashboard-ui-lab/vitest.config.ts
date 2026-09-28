import { defineProject } from 'vitest/config'

export default defineProject({
  root: import.meta.dirname,
  test: {
    name: 'dashboard-ui-lab',
    include: ['scripts/*.test.ts'],
  },
})
