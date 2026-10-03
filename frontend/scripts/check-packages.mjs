import { writeFile } from 'node:fs/promises'
const packages = [
  'react',
  'react-dom',
  'react-router',
  '@tanstack/react-query',
  'react-hook-form',
  '@hookform/resolvers',
  'zod',
  'tailwindcss',
  '@tailwindcss/vite',
  '@radix-ui/react-dialog',
  'gsap',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  'lucide-react',
  '@fontsource-variable/vazirmatn',
  'vite',
  '@vitejs/plugin-react',
  'typescript',
  '@types/react',
  '@types/react-dom',
  '@types/three',
  '@types/node',
  'vitest',
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  'jsdom',
  '@playwright/test',
  'eslint',
  '@eslint/js',
  'typescript-eslint',
  'eslint-plugin-react-hooks',
  'globals',
]
const compatibleMajors = { 'react-router': 7, typescript: 6, jsdom: 26, '@types/node': 22 }
const results = await Promise.all(
  packages.map(async (name) => {
    const response = await fetch(
      `https://registry.yarnpkg.com/${name}${name in compatibleMajors ? '' : '/latest'}`,
      { signal: AbortSignal.timeout(30000) },
    )
    if (!response.ok) throw new Error(`${name}: ${response.status}`)
    let data = await response.json()
    if (name in compatibleMajors) {
      const versions = Object.keys(data.versions)
        .filter(
          (version) =>
            /^\d+\.\d+\.\d+$/.test(version) &&
            Number(version.split('.')[0]) === compatibleMajors[name],
        )
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
      data = data.versions[versions.at(-1)]
    }
    return {
      name,
      version: data.version,
      engines: data.engines,
      peerDependencies: data.peerDependencies,
    }
  }),
)
await writeFile(
  new URL('../docs/dependencies.json', import.meta.url),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      registry: 'https://registry.yarnpkg.com',
      packages: results,
    },
    null,
    2,
  ) + '\n',
)
for (const result of results) console.log(JSON.stringify(result))
