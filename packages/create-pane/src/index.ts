#!/usr/bin/env node

import { mkdirSync, writeFileSync, existsSync, cpSync, readdirSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Parse args ──

const args = process.argv.slice(2)
const projectName = args[0]
const templateFlag = args.find(a => a.startsWith('--template='))?.split('=')[1]
  ?? (args.includes('--claude') ? 'with-claude' : 'minimal')

if (!projectName) {
  console.log(`
  Usage: npx create-pane <project-name> [options]

  Options:
    --template=minimal     Starter agent (default)
    --template=with-claude Claude API agent
    --claude               Shorthand for --template=with-claude

  Examples:
    npx create-pane my-app
    npx create-pane my-app --claude
`)
  process.exit(0)
}

// ── Create project ──

const projectDir = resolve(process.cwd(), projectName)

if (existsSync(projectDir)) {
  console.error(`Error: Directory "${projectName}" already exists.`)
  process.exit(1)
}

console.log(`\n  Creating Pane app in ./${projectName}...\n`)

mkdirSync(projectDir, { recursive: true })

// ── Write package.json ──

const pkg = {
  name: projectName,
  version: '0.0.1',
  private: true,
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'vite build',
    ...(templateFlag === 'with-claude' ? { proxy: 'node server.js' } : {}),
  },
  dependencies: {
    '@pane/core': '^0.0.1',
    '@pane/renderer': '^0.0.1',
    '@pane/theme': '^0.0.1',
    react: '^19.0.0',
    'react-dom': '^19.0.0',
  },
  devDependencies: {
    '@types/react': '^19.0.0',
    '@types/react-dom': '^19.0.0',
    '@vitejs/plugin-react': '^4.0.0',
    typescript: '^5.7.0',
    vite: '^6.0.0',
  },
}

writeFileSync(join(projectDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')

// ── Write tsconfig ──

writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'bundler',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    jsx: 'react-jsx',
    resolveJsonModule: true,
    isolatedModules: true,
  },
  include: ['src'],
}, null, 2) + '\n')

// ── Write vite config ──

writeFileSync(join(projectDir, 'vite.config.ts'), `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`)

// ── Write index.html ──

writeFileSync(join(projectDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pane</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`)

// ── Write .gitignore ──

writeFileSync(join(projectDir, '.gitignore'), `node_modules
dist
.env
.env.local
`)

// ── Write source files ──

mkdirSync(join(projectDir, 'src'), { recursive: true })

if (templateFlag === 'with-claude') {
  // Claude template
  writeFileSync(join(projectDir, 'src', 'main.tsx'), `import { createRoot } from 'react-dom/client'
import { createPane, claudeAgent } from '@pane/core'
import { PaneProvider, PaneRenderer } from '@pane/renderer'
import { defaultTheme } from '@pane/theme'

const pane = createPane({
  agent: claudeAgent({
    proxyUrl: 'http://localhost:3001/api/claude',
    model: 'claude-sonnet-4-6',
  }),
})

function App() {
  return (
    <PaneProvider runtime={pane} theme={defaultTheme}>
      <PaneRenderer />
    </PaneProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
`)

  writeFileSync(join(projectDir, 'src', 'env.d.ts'), `/// <reference types="vite/client" />
`)

  writeFileSync(join(projectDir, 'server.js'), `import { createServer } from 'http'
import { readFileSync } from 'fs'

let apiKey = process.env.ANTHROPIC_API_KEY
try {
  const env = readFileSync('.env', 'utf-8')
  for (const line of env.split('\\n')) {
    const [k, ...v] = line.split('=')
    if (k?.trim() === 'ANTHROPIC_API_KEY') apiKey = v.join('=').trim()
  }
} catch {}

if (!apiKey) { console.error('Set ANTHROPIC_API_KEY in .env'); process.exit(1) }

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method === 'POST' && req.url === '/api/claude') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body,
      })
      const data = await r.text()
      res.writeHead(r.status, { 'Content-Type': 'application/json' })
      res.end(data)
    } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: String(e) })) }
    return
  }
  res.writeHead(404); res.end()
}).listen(3001, () => console.log('Pane proxy on http://localhost:3001'))
`)

  writeFileSync(join(projectDir, '.env.example'), `ANTHROPIC_API_KEY=sk-ant-your-key-here
`)

} else {
  // Minimal template — starter agent
  writeFileSync(join(projectDir, 'src', 'main.tsx'), `import { createRoot } from 'react-dom/client'
import { createPane, functionAgent } from '@pane/core'
import { PaneProvider, PaneRenderer } from '@pane/renderer'
import { defaultTheme } from '@pane/theme'
import type { PaneInput, PaneSession, PaneSessionUpdate } from '@pane/core'

// Your agent — replace this with your own logic
const agent = functionAgent(async (input: PaneInput, session: PaneSession): Promise<PaneSessionUpdate> => {
  const isFirst = session.contexts.length === 0

  return {
    contexts: [{
      id: 'main',
      operation: isFirst ? 'create' : 'update',
      label: 'Home',
      modality: 'conversational',
      view: {
        layout: { pattern: 'stack' },
        panels: [
          {
            id: 'response',
            atom: 'text',
            props: {
              content: isFirst
                ? 'Welcome to Pane. This surface adapts to whatever you need.'
                : \`You said: "\${input.content}"\`,
              level: 'body',
            },
            source: 'my-agent',
          },
        ],
      },
    }],
    agents: [{ id: 'my-agent', name: 'My Agent', state: 'idle', lastActive: Date.now() }],
  }
})

const pane = createPane({ agent })

function App() {
  return (
    <PaneProvider runtime={pane} theme={defaultTheme}>
      <PaneRenderer />
    </PaneProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
`)
}

// ── Done ──

console.log(`  Done! Next steps:\n`)
console.log(`    cd ${projectName}`)
console.log(`    npm install`)

if (templateFlag === 'with-claude') {
  console.log(`    cp .env.example .env    # add your Anthropic API key`)
  console.log(`    node server.js          # start the proxy (terminal 1)`)
  console.log(`    npm run dev             # start the app (terminal 2)`)
} else {
  console.log(`    npm run dev`)
}

console.log(`\n  Open http://localhost:5173 and start building.\n`)
