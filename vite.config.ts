import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

// Mount the /api/*.ts Edge handlers in-process during `npm run dev` so the
// app behaves the same as on Vercel without `vercel dev` / login / link.
function devApi(): Plugin {
  const routes: Array<{ path: string; file: string }> = [
    { path: '/api/ais', file: '/api/ais.ts' },
    { path: '/api/pursue', file: '/api/pursue.ts' },
    { path: '/api/asset', file: '/api/asset.ts' },
  ]

  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      for (const { path, file } of routes) {
        server.middlewares.use(path, (req, res) => {
          void handle(req, res, path, file)
        })
      }

      async function handle(
        req: IncomingMessage,
        res: ServerResponse,
        path: string,
        file: string,
      ) {
        try {
          const mod = await server.ssrLoadModule(file)
          const handler = mod.default as (request: Request) => Promise<Response>
          if (typeof handler !== 'function') {
            res.statusCode = 500
            res.end(`No default export in ${file}`)
            return
          }
          const webReq = await nodeToWebRequest(req, path)
          const webRes = await handler(webReq)
          await writeWebResponse(webRes, res)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'text/plain')
          res.end((e as Error).stack || String(e))
        }
      }
    },
  }
}

async function nodeToWebRequest(
  req: IncomingMessage,
  mountedPath: string,
): Promise<Request> {
  const host = req.headers.host || 'localhost'
  // req.url is the path *after* the mount, e.g. "/" or "?u=...". Re-assemble.
  const tail = req.url || ''
  const url = `http://${host}${mountedPath}${tail.startsWith('/') || tail.startsWith('?') ? tail : `/${tail}`}`

  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(', '))
    else if (typeof v === 'string') headers.set(k, v)
  }

  let body: ArrayBuffer | undefined
  const method = (req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    if (chunks.length) {
      const buf = Buffer.concat(chunks)
      body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    }
  }

  return new Request(url, { method, headers, body })
}

async function writeWebResponse(webRes: Response, res: ServerResponse): Promise<void> {
  res.statusCode = webRes.status
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  if (!webRes.body) {
    res.end()
    return
  }

  const reader = webRes.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  } finally {
    res.end()
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
  resolve: {
    dedupe: ['three', 'react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/rapier'],
  },
})
