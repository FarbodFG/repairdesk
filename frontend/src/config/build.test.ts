// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { loadEnv } from 'vite'
import { expect, it, vi } from 'vitest'

it('production API settings override a development loopback address', () => {
  const temporaryRoot = resolve(tmpdir())
  const directory = resolve(mkdtempSync(join(temporaryRoot, 'repairdesk-build-')))
  if (dirname(directory) !== temporaryRoot) throw new Error('Unexpected temporary directory')
  vi.stubEnv('VITE_API_BASE_URL', undefined)
  try {
    writeFileSync(join(directory, '.env'), 'VITE_API_BASE_URL=http://127.0.0.1:8000/api\n')
    writeFileSync(
      join(directory, '.env.production'),
      readFileSync(new URL('../../.env.production', import.meta.url)),
    )
    expect(loadEnv('production', directory).VITE_API_BASE_URL).toBe('/api')
    expect(loadEnv('development', directory).VITE_API_BASE_URL).toBe('http://127.0.0.1:8000/api')
  } finally {
    vi.unstubAllEnvs()
    rmSync(directory, { recursive: true, force: true })
  }
})
