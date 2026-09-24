import type { DomNodeExpectation } from '../domAcceptance/types'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'pathe'

export const RETAIL_GOODS_CARD_ROUTE = '/pages/order/goods-card-contract/index'
export const RETAIL_GOODS_CARD_VARIANTS = ['cart', 'order', 'specs'] as const

const CARD_CLASS = 'contains(concat(" ", @class, " "), " wr-goods-card ")'

export function retailGoodsCardSelector(variant: string, kind: 'explicit' | 'default') {
  return `//*[@id="retail-${variant}-${kind}-host"]//*[${CARD_CLASS} and string-length(@id) > 0]`
}

export function retailGoodsCardNodes(stage: 'explicit' | 'updated' | 'cleared'): DomNodeExpectation[] {
  return RETAIL_GOODS_CARD_VARIANTS.flatMap((variant) => {
    const explicit = retailGoodsCardSelector(variant, 'explicit')
    const fallback = retailGoodsCardSelector(variant, 'default')
    const expectedId = stage === 'cleared' ? '[starts-with(@id, "goods-card-")]' : `[@id="retail-${variant}-${stage}"]`
    return [
      { selector: `${explicit}${expectedId}`, query: 'xpath' as const },
      { selector: `${fallback}[starts-with(@id, "goods-card-")]`, query: 'xpath' as const },
      {
        selector: `${explicit}//*[contains(concat(" ", @class, " "), " wr-goods-card__title ")]`,
        query: 'xpath' as const,
        text: '商品标识保留',
      },
    ]
  })
}

async function installRetailGoodsCardProbe(projectRoot: string) {
  const appPath = path.join(projectRoot, 'src/app.vue')
  const privateConfigPath = path.join(projectRoot, 'project.private.config.json')
  const pageRoot = path.join(projectRoot, 'src', RETAIL_GOODS_CARD_ROUTE.slice(1), '..')
  const [appSource, privateConfigSource, pageSource] = await Promise.all([
    readFile(appPath, 'utf8'),
    readFile(privateConfigPath, 'utf8'),
    readFile(path.resolve(import.meta.dirname, '../../fixtures/retail-goods-card/index.vue'), 'utf8'),
  ])
  const marker = '        \'order-confirm/index\','
  if (appSource.split(marker).length !== 2) {
    throw new Error('Retail template order subpackage entry must occur exactly once')
  }
  const privateConfig = JSON.parse(privateConfigSource) as {
    condition: { miniprogram: { list: Array<Record<string, unknown>> } }
  }
  privateConfig.condition.miniprogram.list.push({
    name: '商品卡片标识回归',
    pathName: RETAIL_GOODS_CARD_ROUTE.slice(1),
    query: '',
    scene: null,
  })
  // 不覆盖已有页面，避免测试夹具与模板未来新增路由冲突。
  await mkdir(pageRoot)
  await writeFile(path.join(pageRoot, 'index.vue'), pageSource, 'utf8')
  await writeFile(appPath, appSource.replace(marker, `${marker}\n        'goods-card-contract/index',`), 'utf8')
  await writeFile(privateConfigPath, `${JSON.stringify(privateConfig, null, 2)}\n`, 'utf8')
}

/** 在隔离模板中注册测试页面，保留真实组件、固定版本依赖和开发者工具页面条件。 */
export async function createRetailGoodsCardProject(templateRoot: string) {
  const parent = path.resolve(import.meta.dirname, '../../../.tmp/e2e/retail-goods-card')
  await mkdir(parent, { recursive: true })
  const projectRoot = await mkdtemp(path.join(parent, 'fixture-'))
  try {
    await cp(templateRoot, projectRoot, {
      recursive: true,
      filter: source => !['dist', 'node_modules', '.weapp-vite'].includes(path.relative(templateRoot, source).split('/')[0]!),
    })
    const packageJson = JSON.parse(await readFile(path.join(templateRoot, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    for (const name of Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
      const target = path.join(projectRoot, 'node_modules', name)
      await mkdir(path.dirname(target), { recursive: true })
      // 分别链接真实依赖路径，避免 Windows 整目录 junction 再穿过 pnpm 链接。
      await symlink(await realpath(path.join(templateRoot, 'node_modules', name)), target, 'junction')
    }
    await installRetailGoodsCardProbe(projectRoot)
    return projectRoot
  }
  catch (error) {
    await rm(projectRoot, { recursive: true, force: true })
    throw error
  }
}
