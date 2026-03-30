/**
 * @file 网络与环境工具。
 */
import net from 'node:net'
import process from 'node:process'

const absolutePathPattern = /^(?:[a-z]+:)?[\\/]/i

/** getPort 的方法封装。 */
export function getPort(ports: number | number[], host?: string) {
  const queue = Array.isArray(ports) ? [...ports] : [ports]
  queue.push(0)

  const checkPort = (port: number) => {
    return new Promise<number>((resolve, reject) => {
      const server = net.createServer()
      server.unref()
      server.on('error', reject)

      const options: net.ListenOptions = { port }
      if (host) {
        options.host = host
      }

      server.listen(options, () => {
        const address = server.address()
        const resolvedPort = typeof address === 'object' && address ? address.port : port
        server.close(() => {
          resolve(resolvedPort)
        })
      })
    })
  }

  return queue.reduce<Promise<number>>((sequence, port) => {
    return sequence.catch(() => checkPort(port))
  }, Promise.reject(new Error('No available port')))
}

/** isRelative 的方法封装。 */
export function isRelative(value: string) {
  return !absolutePathPattern.test(value)
}

export const isWindows = process.platform === 'win32'
