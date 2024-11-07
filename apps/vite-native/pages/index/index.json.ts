import type { Page } from 'weapp-vite/json'
import fs from 'node:fs/promises'
import path from 'node:path'
// import process from 'node:process'
import xxx from '@/assets/share'
import shared from './shared.json'

// console.log('import.meta.env: ', import.meta.env)
// console.log('import.meta.dirname: ', import.meta.dirname)
// console.log('MP_PLATFORM: ', import.meta.env.MP_PLATFORM)
// console.log(typeof import.meta.env.VITE_ENV, typeof import.meta.env.VITE_XXX)
// console.log(import.meta.env.DEV, import.meta.env.MODE, import.meta.env.PROD)
const key = await fs.readFile(path.resolve(import.meta.dirname, 'x.txt'), 'utf8')
// console.log(key)
export default <Page>{
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-divider': 'tdesign-miniprogram/divider/divider',
    'ice-avatar': '@/avatar/avatar',
  },
  ...shared,
  ...xxx,
  cccaaa: key,
}
