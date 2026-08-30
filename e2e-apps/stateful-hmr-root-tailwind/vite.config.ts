import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    tailwindcss: {
      cssEntries: [
        'tailwind.css',
        'sub-normal/pages/index.css',
        'sub-independent/pages/index.css',
      ],
    },
  },
})
