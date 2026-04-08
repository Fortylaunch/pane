/**
 * Proxy server for Claude API calls from the browser.
 * Supports both regular and streaming responses.
 *
 * Run: npx tsx examples/dev/server.ts
 */

import { createServer } from 'http'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env manually
try {
  const envPath = resolve(import.meta.dirname, '.env')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
} catch {
  // .env not found
}

const API_KEY = process.env.VITE_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY

if (!API_KEY) {
  console.error('No API key found. Set ANTHROPIC_API_KEY in examples/dev/.env')
  process.exit(1)
}

const PORT = 3001

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/api/claude') {
    let body = ''
    for await (const chunk of req) body += chunk

    try {
      const parsed = JSON.parse(body)
      const isStreaming = parsed.stream === true

      // Log request size for debugging context budget
      const systemLen = typeof parsed.system === 'string' ? parsed.system.length : JSON.stringify(parsed.system ?? '').length
      const msgLen = JSON.stringify(parsed.messages ?? []).length
      const totalKB = Math.round(body.length / 1024)
      console.log(`[proxy] ${parsed.model} | system: ${Math.round(systemLen/1024)}KB | messages: ${Math.round(msgLen/1024)}KB | total: ${totalKB}KB | stream: ${isStreaming}`)

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body,
      })

      if (isStreaming && apiRes.body) {
        // Stream SSE directly to the client
        res.writeHead(apiRes.status, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        const reader = apiRes.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(decoder.decode(value, { stream: true }))
        }

        res.end()
      } else {
        // Regular response
        const data = await apiRes.text()
        res.writeHead(apiRes.status, { 'Content-Type': 'application/json' })
        res.end(data)
      }
    } catch (err) {
      console.error('[proxy] Error:', String(err))
      try {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: String(err) }))
        }
      } catch {
        // Response stream already destroyed (client disconnected)
      }
    }
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

// Prevent crashes from killing the proxy
process.on('uncaughtException', (err) => {
  console.error('[proxy] Uncaught exception (staying up):', err.message)
})

server.listen(PORT, () => {
  console.log(`Pane proxy running on http://localhost:${PORT}`)
  console.log('Supports regular and streaming responses')
})
