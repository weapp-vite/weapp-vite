import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: __dirname,
  base: './',
  appType: 'spa',
  publicDir: false,
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
  build: {
    outDir: resolve(__dirname, '../modules/analyze-dashboard'),
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name(id) {
                if (!id.includes('node_modules')) {
                  return undefined
                }
                if (id.includes('echarts')) {
                  return 'echarts'
                }
                if (id.includes('vue')) {
                  return 'vue'
                }
                return 'vendor'
              },
            },
          ],
        },
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
