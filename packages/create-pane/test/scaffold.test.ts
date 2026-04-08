import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(__dirname, '..', 'dist', 'index.js')
const PROJECT_NAME = 'my-app'

function scaffold(cwd: string, ...args: string[]) {
  execFileSync('node', [CLI, PROJECT_NAME, ...args], { cwd, stdio: 'pipe' })
  return join(cwd, PROJECT_NAME)
}

function readJson(p: string) {
  return JSON.parse(readFileSync(p, 'utf-8'))
}

describe('create-pane scaffolder', () => {
  let tmp: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'create-pane-test-'))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('CLI dist exists (build ran)', () => {
    expect(existsSync(CLI)).toBe(true)
  })

  describe('minimal template', () => {
    it('scaffolds a working project', () => {
      const dir = scaffold(tmp)

      // Expected files
      for (const f of ['package.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'src/main.tsx', '.gitignore']) {
        expect(existsSync(join(dir, f)), `missing ${f}`).toBe(true)
      }

      // package.json shape
      const pkg = readJson(join(dir, 'package.json'))
      expect(pkg.name).toBe(PROJECT_NAME)
      expect(pkg.private).toBe(true)
      expect(pkg.type).toBe('module')
      expect(pkg.scripts.dev).toBe('vite')
      expect(pkg.scripts.build).toBe('vite build')
      expect(pkg.scripts.proxy).toBeUndefined()
      expect(pkg.dependencies['@pane/core']).toBeDefined()
      expect(pkg.dependencies['@pane/renderer']).toBeDefined()
      expect(pkg.dependencies['@pane/theme']).toBeDefined()
      expect(pkg.dependencies.react).toBeDefined()
      expect(pkg.dependencies['react-dom']).toBeDefined()
      expect(pkg.devDependencies.vite).toBeDefined()
      expect(pkg.devDependencies['@vitejs/plugin-react']).toBeDefined()
      expect(pkg.devDependencies.typescript).toBeDefined()

      // main.tsx imports
      const main = readFileSync(join(dir, 'src', 'main.tsx'), 'utf-8')
      expect(main).toContain("from '@pane/core'")
      expect(main).toContain("from '@pane/renderer'")
      expect(main).toContain("from '@pane/theme'")
      expect(main).toContain('functionAgent')
      expect(main).toContain('createPane')
      expect(main).toContain('PaneRenderer')
      expect(main).not.toContain('claudeAgent')

      // Claude-only files should NOT exist
      expect(existsSync(join(dir, 'server.js'))).toBe(false)
      expect(existsSync(join(dir, '.env.example'))).toBe(false)

      // tsconfig sanity
      const tsconfig = readJson(join(dir, 'tsconfig.json'))
      expect(tsconfig.compilerOptions.jsx).toBe('react-jsx')
      expect(tsconfig.include).toContain('src')
    })

    it('is the default template (no flag)', () => {
      const dir = scaffold(tmp)
      const main = readFileSync(join(dir, 'src', 'main.tsx'), 'utf-8')
      expect(main).toContain('functionAgent')
    })

    it('accepts --template=minimal explicitly', () => {
      const dir = scaffold(tmp, '--template=minimal')
      const main = readFileSync(join(dir, 'src', 'main.tsx'), 'utf-8')
      expect(main).toContain('functionAgent')
    })
  })

  describe('with-claude template', () => {
    it('scaffolds a Claude-enabled project via --claude', () => {
      const dir = scaffold(tmp, '--claude')

      for (const f of [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'index.html',
        'src/main.tsx',
        'src/env.d.ts',
        'server.js',
        '.env.example',
      ]) {
        expect(existsSync(join(dir, f)), `missing ${f}`).toBe(true)
      }

      const pkg = readJson(join(dir, 'package.json'))
      expect(pkg.name).toBe(PROJECT_NAME)
      expect(pkg.scripts.dev).toBe('vite')
      expect(pkg.scripts.build).toBe('vite build')
      expect(pkg.scripts.proxy).toBe('node server.js')
      expect(pkg.dependencies['@pane/core']).toBeDefined()
      expect(pkg.dependencies['@pane/renderer']).toBeDefined()
      expect(pkg.dependencies['@pane/theme']).toBeDefined()

      const main = readFileSync(join(dir, 'src', 'main.tsx'), 'utf-8')
      expect(main).toContain("from '@pane/core'")
      expect(main).toContain("from '@pane/renderer'")
      expect(main).toContain("from '@pane/theme'")
      expect(main).toContain('claudeAgent')
      expect(main).toContain('proxyUrl')
      expect(main).not.toContain('functionAgent')

      const server = readFileSync(join(dir, 'server.js'), 'utf-8')
      expect(server).toContain('api.anthropic.com')
      expect(server).toContain('ANTHROPIC_API_KEY')

      const envExample = readFileSync(join(dir, '.env.example'), 'utf-8')
      expect(envExample).toContain('ANTHROPIC_API_KEY')
    })

    it('accepts --template=with-claude', () => {
      const dir = scaffold(tmp, '--template=with-claude')
      expect(existsSync(join(dir, 'server.js'))).toBe(true)
      const main = readFileSync(join(dir, 'src', 'main.tsx'), 'utf-8')
      expect(main).toContain('claudeAgent')
    })
  })

  it('errors when target directory already exists', () => {
    scaffold(tmp)
    expect(() => scaffold(tmp)).toThrow()
  })
})
