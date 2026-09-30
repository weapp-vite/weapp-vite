import type { Tool } from './types.js'

import { randomUUID } from 'node:crypto'

import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises'

import path from 'node:path'

import { createTwoFilesPatch } from 'diff'

// eslint-disable-next-line e18e/ban-dependencies -- Preserve cross-platform command resolution, cancellation and process cleanup semantics.
import { execa } from 'execa'

import { z } from 'zod'

import { hash } from './config.js'

import { authorize, requireTrust, safePath, sensitive } from './security.js'

import { bounded } from './text.js'

export { bounded } from './text.js'

async function walk(
  root: string,
  directory = '.',
  result: string[] = [],
): Promise<string[]> {
  if (result.length >= 2000) {
    return result
  }

  for (const item of await readdir(await safePath(root, directory), {
    withFileTypes: true,
  })) {
    const relative = path.join(directory, item.name)

    if (
      sensitive(relative)
      || [
        'node_modules',
        'dist',
        'coverage',
        '.turbo',
        '.astro',
        '.wrangler',
      ].includes(item.name)
      || item.isSymbolicLink()
    ) {
      continue
    }

    if (item.isDirectory()) {
      await walk(root, relative, result)
    }
    else
      if (item.isFile()) {
        result.push(relative)
      }

    if (result.length >= 2000) {
      break
    }
  }

  return result
}

export function fileTools(): Tool[] {
  const readSchema = z.strictObject({
    path: z.string(),
    startLine: z.number().int().positive().default(1),
    endLine: z.number().int().positive().optional(),
  })

  const listSchema = z.strictObject({ directory: z.string().default('.') })

  const searchSchema = z.strictObject({ query: z.string().min(1), directory: z.string().default('.') })

  const createSchema = z.strictObject({ path: z.string(), content: z.string().max(500_000) })

  const editSchema = z.strictObject({
    path: z.string(),
    expectedHash: z.string(),
    oldText: z.string().min(1),
    newText: z.string(),
  })

  const shellSchema = z.strictObject({
    command: z.string().min(1),
    timeoutMs: z.number().int().positive().max(600_000).default(120_000),
  })

  return [
    {
      name: 'list_files',
      description:
        'List up to 2000 project files, excluding generated files, secrets, and symlinks.',
      schema: listSchema,
      mutates: false,
      async execute(input, ctx) {
        const a = listSchema.parse(input)

        return { text: (await walk(ctx.root, a.directory)).join('\n') }
      },
    },
    {
      name: 'read_file',
      description:
        'Read numbered lines and the SHA-256 of the full file. Use that hash for edit_file.',
      schema: readSchema,
      mutates: false,
      async execute(input, ctx) {
        const a = readSchema.parse(input)

        const text = await readFile(await safePath(ctx.root, a.path), 'utf8')

        const lines = text.split('\n')

        return {
          text: bounded(
            lines
              .slice(a.startLine - 1, a.endLine ?? a.startLine + 299)
              .map((line, i) => `${i + a.startLine}: ${line}`)
              .join('\n'),
          ),
          data: { path: a.path, hash: hash(text), lines: lines.length },
        }
      },
    },
    {
      name: 'search_files',
      description:
        'Literal text search in source files with line numbers. No regex or shell evaluation.',
      schema: searchSchema,
      mutates: false,
      async execute(input, ctx) {
        const a = searchSchema.parse(input)

        const matches: string[] = []

        for (const f of await walk(ctx.root, a.directory)) {
          const text = await readFile(
            await safePath(ctx.root, f),
            'utf8',
          ).catch(() => '')

          if (text.includes('\0') || text.length > 500_000) {
            continue
          }

          text.split('\n').forEach((line, i) => {
            if (line.includes(a.query) && matches.length < 200) {
              matches.push(`${f}:${i + 1}: ${line}`)
            }
          })

          if (matches.length >= 200) {
            break
          }
        }

        return { text: bounded(matches.join('\n')) }
      },
    },
    {
      name: 'create_file',
      description: 'Create a new file without overwriting any existing file.',
      schema: createSchema,
      mutates: true,
      async execute(input, ctx) {
        await requireTrust(ctx)

        const a = createSchema.parse(input)

        const f = await safePath(ctx.root, a.path)

        await mkdir(path.dirname(f), { recursive: true })

        await safePath(ctx.root, a.path)

        await writeFile(f, a.content, { flag: 'wx' })

        return {
          text: createTwoFilesPatch('/dev/null', a.path, '', a.content),
          data: { hash: hash(a.content), path: a.path },
        }
      },
    },
    {
      name: 'edit_file',
      description:
        'Replace exactly one occurrence of oldText, only if the file still matches expectedHash. Re-read on conflicts.',
      schema: editSchema,
      mutates: true,
      async execute(input, ctx) {
        await requireTrust(ctx)

        const a = editSchema.parse(input)

        const f = await safePath(ctx.root, a.path)

        const before = await readFile(f, 'utf8')

        if (hash(before) !== a.expectedHash) {
          throw new Error(
            'File changed since it was read. Re-read and reconcile the user changes.',
          )
        }

        if (before.split(a.oldText).length !== 2) {
          throw new Error(
            'oldText must occur exactly once. Include more context.',
          )
        }

        const after = before.replace(a.oldText, () => a.newText)

        const temporary = `${f}.${randomUUID()}.tmp`

        try {
          const { stat } = await import('node:fs/promises')

          await writeFile(temporary, after, {
            flag: 'wx',
            mode: (await stat(f)).mode,
          })

          await safePath(ctx.root, a.path)

          if (hash(await readFile(f, 'utf8')) !== a.expectedHash) {
            throw new Error(
              'Concurrent file change detected; edit not applied.',
            )
          }

          await rename(temporary, f)
        }
        finally {
          await unlink(temporary).catch(() => {
          })
        }

        return {
          text: createTwoFilesPatch(a.path, a.path, before, after),
          data: { path: a.path, hash: hash(after) },
        }
      },
    },
    {
      name: 'git_diff',
      description:
        'Show tracked changes and untracked file names, preserving the current Git state.',
      schema: z.strictObject({}),
      mutates: false,
      async execute(_input, ctx) {
        // Git may execute configured clean/process filters even with textconv
        // disabled. Override every effective filter before reading the worktree.

        const filters = await execa('git', ['config', '--null', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], {
          cwd: ctx.root,
          cancelSignal: ctx.signal,
          reject: false,
        })

        const gitConfig = ['-c', 'core.fsmonitor=false']

        for (const key of filters.stdout.split('\0').filter(Boolean)) {
          gitConfig.push('-c', `${key}=${key.endsWith('.required') ? 'false' : ''}`)
        }

        const diff = await execa(
          'git',
          [
            ...gitConfig,
            '--no-pager',
            'diff',
            '--no-ext-diff',
            '--no-textconv',
            '--',
            '.',
            ':!.env*',
            ':!*.pem',
            ':!*.key',
            ':!*.p12',
            ':!.weapp-agent/**',
            ':!.npmrc',
          ],
          { cwd: ctx.root, cancelSignal: ctx.signal, reject: false },
        )

        const status = await execa('git', [...gitConfig, 'status', '--short'], {
          cwd: ctx.root,
          cancelSignal: ctx.signal,
          reject: false,
        })

        return { text: bounded(`${status.stdout}\n${diff.stdout}`) }
      },
    },
    {
      name: 'shell',
      description:
        'Execute an arbitrary shell command. Always requires exact-command approval; never use it to bypass a denied operation.',
      schema: shellSchema,
      mutates: true,
      async execute(input, ctx) {
        const a = shellSchema.parse(input)

        await authorize(ctx, 'command', a.command, { root: ctx.root, ...a })

        const result = await execa(a.command, {
          cwd: ctx.root,
          shell: true,
          cancelSignal: ctx.signal,
          timeout: a.timeoutMs,
          forceKillAfterDelay: 2000,
          reject: false,
          maxBuffer: 2_000_000,
        })

        return {
          text: bounded(`${result.stdout}\n${result.stderr}`),
          data: { exitCode: result.exitCode, timedOut: result.timedOut },
        }
      },
    },
  ]
}
