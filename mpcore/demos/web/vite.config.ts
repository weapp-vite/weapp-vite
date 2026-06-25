import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { createVueOxcTsconfigGuard } from '../../../scripts/vite/vueOxcTsconfigGuard'

const vuePlugin = vue()

export default defineConfig({
  plugins: [
    vuePlugin,
    createVueOxcTsconfigGuard(vuePlugin, 'mpcore-web-demo-vue-oxc-tsconfig-guard'),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 4179,
  },
})
