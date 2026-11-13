import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'

/** 创建同时从主包与普通分包消费同一物理资源的原生宿主回归项目。 */
export async function createSubpackageOutputFixture() {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'subpackage-native-')))
  const routes = ['pages/index/index', 'packages/feature/pages/index/index']
  await mkdir(path.join(root, 'node_modules'), { recursive: true })
  await symlink(path.resolve(import.meta.dirname, '../../..'), path.join(root, 'node_modules/weapp-vite'), 'junction')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'subpackage-native', private: true, type: 'module' }))
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid: 'wx6ffee4673b257014', compileType: 'miniprogram', miniprogramRoot: 'dist/', srcMiniprogramRoot: 'src/', setting: {} }))
  await writeFile(path.join(root, 'project.private.config.json'), JSON.stringify({ condition: { miniprogram: { list: routes.map(route => ({ name: route, pathName: route, query: '' })) } } }))
  await mkdir(path.join(root, 'src'), { recursive: true })
  await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: [routes[0]], subPackages: [{ root: 'packages/feature', pages: ['pages/index/index'] }] }))
  await writeFile(path.join(root, 'src/app.js'), 'App({})')
  for (const route of routes) {
    const directory = path.dirname(route)
    const image = route.startsWith('packages/') ? '../../image.png' : '../../packages/feature/image.png'
    await mkdir(path.join(root, 'src', directory), { recursive: true })
    await writeFile(path.join(root, 'src', `${route}.js`), `import image from '${image}'; Page({ data: { image }, runE2E() { return new Promise(resolve => wx.getImageInfo({ src: this.data.image, success: result => resolve({ ok: true, type: result.type }), fail: error => resolve({ ok: false, message: error.errMsg }) })) } })`)
    await writeFile(path.join(root, 'src', `${route}.json`), '{}')
    await writeFile(path.join(root, 'src', `${route}.wxml`), '<view class="page"><image id="asset" src="{{image}}"/><text>subpackage output</text></view>')
    await writeFile(path.join(root, 'src', `${route}.wxss`), `.page { background-image: url('${image}'); }`)
  }
  await writeFile(path.join(root, 'src/packages/feature/image.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64'))
  return { root, routes, close: async () => rm(root, { recursive: true, force: true }) }
}
