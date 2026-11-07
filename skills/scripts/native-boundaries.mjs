import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'

/** 保留真实 tarball 全部文件，仅变更版本与技能标记，验证原生版本选择。 */
export async function verifyNativeBoundaries({ output, run, project, entries, writeJson, modernSkills, skillLink }) {
  const versions = ['900.0.0', '900.1.0', '900.2.0']
  const artifacts = {}
  for (const version of versions) {
    const directory = path.join(output, `wevu-${version}`)
    await fs.cp(path.join(output, 'unpacked-wevu/package'), directory, { recursive: true })
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'))
    manifest.version = version
    await writeJson(path.join(directory, 'package.json'), manifest)
    if (version === versions[2]) {
      await fs.rm(path.join(directory, 'skills'), { recursive: true })
    }
    else {
      await fs.appendFile(path.join(directory, 'skills/wevu-best-practices/SKILL.md'), `\nSkill version fixture: ${version}\n`)
      for (const name of ['category/nested', 'category/subcategory/deepest', 'category/level2/level3/too-deep']) {
        const nested = path.join(directory, 'skills', name)
        await fs.mkdir(nested, { recursive: true })
        await fs.writeFile(path.join(nested, 'SKILL.md'), `---\nname: ${path.basename(name)}\ndescription: Native discovery depth fixture\n---\n# Skill at ${name}\n`)
      }
    }
    await run(directory, ['pack', '--ignore-scripts', '--pack-destination', output], 'npm')
    artifacts[version] = { manifest, bytes: await fs.readFile(path.join(output, `wevu-${version}.tgz`)) }
  }
  const server = createServer((request, response) => {
    const version = /^\/wevu-(\d+\.\d+\.\d+)\.tgz$/.exec(request.url)?.[1]
    if (version && artifacts[version]) {
      response.end(artifacts[version].bytes)
      return
    }
    if (request.url === '/wevu') {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({
        'name': 'wevu',
        'dist-tags': { latest: versions[2] },
        'versions': Object.fromEntries(Object.entries(artifacts).map(([version, { manifest, bytes }]) => [version, {
          ...manifest,
          dist: { tarball: `http://127.0.0.1:${server.address().port}/wevu-${version}.tgz`, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` },
        }])),
      }))
      return
    }
    response.writeHead(302, { location: `https://registry.npmjs.org${request.url}` })
    response.end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const registry = `registry=http://127.0.0.1:${server.address().port}/\n`
  try {
    const upgrade = await project('registry-upgrade', { wevu: versions[0] })
    await fs.writeFile(path.join(upgrade, '.npmrc'), registry)
    await run(upgrade, ['install'])
    assert.deepEqual(await entries(upgrade), [])
    await run(upgrade, ['approve', 'wevu'])
    const linked = path.join(upgrade, '.agents/skills', skillLink('wevu', 'wevu-best-practices'), 'SKILL.md')
    assert.match(await fs.readFile(linked, 'utf8'), /Skill version fixture: 900\.0\.0/)
    await run(upgrade, ['add', `wevu@${versions[1]}`])
    assert.deepEqual(await entries(upgrade), modernSkills ? ['deepest', 'nested', 'wevu-best-practices'] : ['pnpm-wevu-wevu-best-practices'])
    assert.match(await fs.readFile(linked, 'utf8'), /Skill version fixture: 900\.1\.0/)

    const workspace = await project('workspace-versions', {}, ['.agents/skills'], ['projects/*'])
    await fs.writeFile(path.join(workspace, '.npmrc'), registry)
    for (const [index, version] of versions.slice(0, 2).entries()) {
      const child = path.join(workspace, 'projects', `app-${index}`)
      await fs.mkdir(child, { recursive: true })
      await writeJson(path.join(child, 'package.json'), { name: `app-${index}`, private: true, dependencies: { wevu: version } })
    }
    await run(workspace, ['install'])
    await run(workspace, ['approve', 'wevu'])
    const workspaceSkill = path.join(workspace, '.agents/skills', skillLink('wevu', 'wevu-best-practices'), 'SKILL.md')
    assert.match(await fs.readFile(workspaceSkill, 'utf8'), /Skill version fixture: 900\.1\.0/)
    assert.deepEqual(await entries(path.join(workspace, 'projects/app-0')), [])
    assert.deepEqual(await entries(path.join(workspace, 'projects/app-1')), [])
    await writeJson(path.join(workspace, 'projects/app-1/package.json'), { name: 'app-1', private: true, dependencies: { wevu: versions[2] } })
    await run(workspace, ['install', '--no-frozen-lockfile'])
    assert.deepEqual(await entries(workspace), [], 'highest version without skills must suppress older skills')
    return [
      { scenario: modernSkills ? 'approved upgrade synchronizes; discovery includes levels two and three, excludes four' : 'approved upgrade synchronizes; only one-level discovery', status: 'pass' },
      { scenario: 'workspace highest version unified at root; highest without skills suppresses older', status: 'pass' },
    ]
  }
  finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}
