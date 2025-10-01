import https from 'node:https'

export function getLatestVersionFromNpm(packageName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}/latest`
    https
      .get(url, (res) => {
        if (!res || (res.statusCode && res.statusCode >= 400)) {
          res?.resume()
          reject(new Error(`Request to ${url} failed with status ${res?.statusCode ?? 'unknown'}`))
          return
        }

        let data = ''
        res.setEncoding('utf8')
        res.on('data', chunk => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data) as { version?: string }
            if (!json.version || typeof json.version !== 'string') {
              reject(new Error(`Unexpected response when fetching ${packageName}: missing version`))
              return
            }
            resolve(json.version)
          }
          catch (err) {
            reject(err)
          }
        })
        res.on('error', reject)
      })
      .on('error', reject)
  })
}

export async function latestVersion(packageName: string, prefix: string = '^') {
  try {
    const resolved = await getLatestVersionFromNpm(packageName)
    return resolved ? `${prefix}${resolved}` : null
  }
  catch {
    return null
  }
}
