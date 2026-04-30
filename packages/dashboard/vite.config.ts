import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'

export default defineConfig({
  root: __dirname,
  base: './',
  appType: 'spa',
  publicDir: false,
  plugins: [
    VueRouter({
      root: __dirname,
      routesFolder: 'src/pages',
      extensions: ['.vue'],
      dts: 'typed-router.d.ts',
      watch: false,
    }),
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
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
                if (id.includes('monaco-editor')) {
                  return 'monaco'
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
