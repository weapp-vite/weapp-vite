import { access, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { cacheRoot } from '../config'
import { copyPreparedSdk } from './portableCache'

const snapshot = path.join(cacheRoot, 'portable-sdk')
const mode = process.argv[2]
if (mode === 'save') {
  await rm(snapshot, { recursive: true, force: true })
  await copyPreparedSdk(cacheRoot, snapshot)
  console.log('Saved dependency-free SDK snapshot.')
}
else if (mode === 'restore') {
  const exists = await access(path.join(snapshot, 'ready.json')).then(() => true, () => false)
  if (exists) {
    await copyPreparedSdk(snapshot, cacheRoot)
    console.log('Restored SDK snapshot into a fresh installation directory.')
  }
  else {
    console.log('No SDK snapshot; prepare a fresh SDK.')
  }
}
else {
  throw new Error('Expected cache:sdk restore or save')
}
