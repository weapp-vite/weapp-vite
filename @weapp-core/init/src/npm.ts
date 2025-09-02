import https from 'node:https'

export function getLatestVersionFromNpm(packageName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}/latest`
    https
      .get(url, (res) => {
        let data = ''
        res.on('data', chunk => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json.version)
          }
          catch (err) {
            reject(err)
          }
        })
      })
      .on('error', reject)
  })
}

export async function latestVersion(packageName: string, prefix: string = '^') {
  let version = 'latest'
  try {
    version = `${prefix}${await getLatestVersionFromNpm(packageName)}`
  }
  catch {

  }
  return version
}
