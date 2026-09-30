import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'
import config from './weapp-vite.config'

export default defineConfig({
  ...config,
  plugins: [weapp()],
})
