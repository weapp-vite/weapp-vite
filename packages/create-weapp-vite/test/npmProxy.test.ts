import type { RequestListener, Server } from 'node:http'
import type { RegistryOptions } from '../src/npm'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 子进程需跨平台且必须在加载 npm transport 前设置代理环境。
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'
import { getPackageVersionsFromNpm } from '../src/npm'
import { proxyOptions } from '../src/npm/proxy'

const servers: Server[] = []
const directories: string[] = []

async function registry(handler: RequestListener) {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('No listening address')
  }
  return `http://127.0.0.1:${address.port}/`
}

async function isolatedRequest(options: RegistryOptions, proxy: string, noProxy = '', userconfig?: string) {
  const { stdout } = await execa(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    const { getPackageVersionsFromNpm, resolveRegistryOptions } = await import(process.env.SCAFFOLD_NPM_MODULE)
    let options = JSON.parse(process.env.SCAFFOLD_NPM_OPTIONS)
    if (process.env.SCAFFOLD_NPM_CONFIG_ROOT) {
      options = await resolveRegistryOptions({ registry: options.registry, projectRoot: process.env.SCAFFOLD_NPM_CONFIG_ROOT })
    }
    console.log(JSON.stringify(await getPackageVersionsFromNpm('weapp-vite', undefined, options)))
  `], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      HTTP_PROXY: proxy,
      HTTPS_PROXY: proxy,
      http_proxy: proxy,
      https_proxy: proxy,
      NO_PROXY: noProxy,
      no_proxy: noProxy,
      npm_config_userconfig: userconfig,
      SCAFFOLD_NPM_CONFIG_ROOT: userconfig ? path.dirname(userconfig) : undefined,
      SCAFFOLD_NPM_MODULE: new URL('../src/npm/index.ts', import.meta.url).href,
      SCAFFOLD_NPM_OPTIONS: JSON.stringify(options),
    },
  })
  return JSON.parse(stdout) as unknown
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }))
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('registry proxy routing', () => {
  it('keeps https-proxy=false from npmrc effective through configuration and real transport', async () => {
    let proxyRequests = 0
    const proxy = await registry((_request, response) => {
      proxyRequests++
      response.end('{"versions":{"9.0.0":{}}}')
    })
    const target = await registry((_request, response) => response.end('{"versions":{"7.2.0":{}}}'))
    const directory = await mkdtemp(path.join(os.tmpdir(), 'scaffold-proxy-'))
    directories.push(directory)
    const userconfig = path.join(directory, 'user.npmrc')
    await writeFile(userconfig, 'https-proxy=false\n')
    expect(await isolatedRequest({ registry: target, strictSSL: true }, proxy, '', userconfig)).toEqual(['7.2.0'])
    expect(proxyRequests).toBe(0)
  })

  it.each(['proxy=false', 'httpsProxy=false', 'httpsProxy=false with configured proxy', 'NO_PROXY=*', 'NO_PROXY list wildcard', 'NO_PROXY IP', 'NO_PROXY port', 'environment NO_PROXY=*'])('bypasses an environment proxy for %s before transport initialization', async (scenario) => {
    let proxyRequests = 0
    const proxy = await registry((_request, response) => {
      proxyRequests++
      response.end('{"versions":{"9.0.0":{}}}')
    })
    const target = await registry((_request, response) => response.end('{"versions":{"7.2.0":{}}}'))
    const options: RegistryOptions = {
      registry: target,
      strictSSL: true,
      [`//${new URL(target).host}/:_authToken`]: 'fixture-private-token',
    }
    if (scenario === 'proxy=false') {
      options.proxy = false
    }
    else if (scenario.startsWith('httpsProxy=false')) {
      options.httpsProxy = false
      options.proxy = scenario.endsWith('configured proxy') ? proxy : undefined
    }
    else if (scenario === 'NO_PROXY=*') {
      options.noProxy = '*'
    }
    else if (scenario === 'NO_PROXY list wildcard') {
      options.noProxy = 'unrelated.example, *, other.example'
    }
    else if (scenario === 'NO_PROXY IP') {
      options.noProxy = '127.0.0.1'
    }
    else if (scenario === 'NO_PROXY port') {
      options.noProxy = new URL(target).host
    }
    expect(await isolatedRequest(options, proxy, scenario === 'environment NO_PROXY=*' ? '*' : '')).toEqual(['7.2.0'])
    expect(proxyRequests).toBe(0)
  })

  it('keeps a non-matching port proxied and does not restore the environment NO_PROXY', async () => {
    let proxyRequests = 0
    const proxy = await registry((_request, response) => {
      proxyRequests++
      response.end('{"versions":{"9.0.0":{}}}')
    })
    const target = await registry((_request, response) => response.end('{"versions":{"7.2.0":{}}}'))
    const targetPort = Number(new URL(target).port)
    const options: RegistryOptions = { registry: target, strictSSL: true, noProxy: `127.0.0.1:${targetPort === 65535 ? 65534 : targetPort + 1}` }
    expect(await isolatedRequest(options, proxy, '*')).toEqual(['9.0.0'])
    expect(proxyRequests).toBe(1)
  })

  it('re-evaluates NO_PROXY after a public redirect', async () => {
    let requestedUrl = ''
    const proxy = await registry((request, response) => {
      requestedUrl = request.url ?? ''
      response.end('{"versions":{"7.2.0":{}}}')
    })
    const target = await registry((_request, response) => {
      response.writeHead(302, { location: 'http://cdn.example/weapp-vite' })
      response.end()
    })
    await expect(getPackageVersionsFromNpm('weapp-vite', undefined, { registry: target, proxy, noProxy: '127.0.0.1', strictSSL: true })).resolves.toEqual(['7.2.0'])
    expect(requestedUrl).toBe('http://cdn.example/weapp-vite')
  })

  it.each([
    ['http://registry.example/', '.EXAMPLE', true],
    ['http://registry.example/', '*.example', true],
    ['http://notexample/', '.example', false],
    ['http://[::1]/', '::1', true],
    ['http://[::1]:8080/', '[::1]:8080', true],
    ['http://[::1]:8080/', '[::1]:8081', false],
    ['https://registry.example/', 'registry.example:443', true],
  ] as const)('matches NO_PROXY %s against %s', (uri, noProxy, direct) => {
    const options: RegistryOptions = { registry: uri, proxy: 'http://proxy.example/', noProxy, strictSSL: true }
    expect(proxyOptions(uri, options).agent === false).toBe(direct)
  })
})
