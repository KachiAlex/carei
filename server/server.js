import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// ─── Middleware ───
const ALLOWED_ORIGINS = [
  'https://careiapp.com',
  'https://www.careiapp.com',
  'https://app.careiapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost',
  'https://localhost',
]
app.use(cors({
  origin(origin, callback) {
    // Allow same-origin / no-origin requests (curl, server-to-server, Capacitor)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked origin: ${origin}`))
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Vercel-compatible wrapper ───
// Each Vercel API file exports: export default async function handler(req, res)
// We import the handler and call it with Express req/res (which are compatible enough)

function route(handler) {
  return async (req, res) => {
    try {
      // Vercel sets req.query from URL params — Express has req.query already
      // Vercel sets req.body from JSON parsing — Express has req.body already
      // Merge params into query for compatibility
      req.query = { ...req.query, ...req.params }
      await handler(req, res)
    } catch (err) {
      console.error('[Route Error]', err)
      if (!res.headersSent) {
        res.status(500).json({ error: err.message })
      }
    }
  }
}

// Helper to dynamically import route handlers
async function load(routePath) {
  const mod = await import(routePath)
  return mod.default
}

// ─── Register all routes ───
// We register routes in an async IIFE so we can dynamically import
async function setupRoutes() {
  const failedRoutes = []
  const loadedRoutes = []

  // ─── Top-level API routes ───
  const topRoutes = [
    'agencies', 'audit-logs', 'availability', 'body-map', 'bulk-invites',
    'care-plans', 'carers', 'clash-detection', 'cleanup', 'clients',
    'data-delete', 'data-export', 'data-retention', 'dbs-checks',
    'device-wipe', 'drug-interactions', 'email', 'events',
    'family-messages', 'family-visits', 'family', 'fix-tenant-id',
    'handover-briefing', 'incidents', 'init-db', 'invites',
    'medication-log', 'messages', 'otp', 'plans', 'public-plans',
    'right-to-work', 'schedule', 'seed-superadmin', 'sos',
    'supervisions', 'tenants', 'training', 'travel', 'upload',
    'user-type', 'visit-approvals', 'visit-detail', 'visit-draft',
    'visit-start', 'visits', 'voice-memos',
    'compliance-dashboard', 'risk-alerts', 'staff-matching', 'outcome-indicators',
  ]

  for (const name of topRoutes) {
    try {
      const handler = await load(`./dist/api/${name}.js`)
      if (handler) {
        app.all(`/api/${name}`, route(handler))
        app.all(`/api/${name}/*`, route(handler))
        loadedRoutes.push(`top/${name}`)
      }
    } catch (err) {
      console.error(`Failed to load route: ${name}`, err.message)
      failedRoutes.push(`top/${name}`)
    }
  }

  // ─── Auth routes (/api/auth/*) ───
  const authRoutes = [
    'biometric-login', 'biometric-token-login', 'biometrics',
    'change-password', 'login-password', 'login', 'logout',
    'me', 'refresh', 'register', 'reset-pin', 'update-profile',
  ]

  for (const name of authRoutes) {
    try {
      const handler = await load(`./dist/api/auth/${name}.js`)
      if (handler) {
        app.all(`/api/auth/${name}`, route(handler))
        loadedRoutes.push(`auth/${name}`)
      }
    } catch (err) {
      console.error(`Failed to load auth route: ${name}`, err.message)
      failedRoutes.push(`auth/${name}`)
    }
  }

  // ─── Manager routes (/api/manager/*) ───
  const managerRoutes = ['assignments', 'caregiver', 'caregivers', 'data', 'overview', 'tasks']

  for (const name of managerRoutes) {
    try {
      const handler = await load(`./dist/api/manager/${name}.js`)
      if (handler) {
        app.all(`/api/manager/${name}`, route(handler))
        loadedRoutes.push(`manager/${name}`)
      }
    } catch (err) {
      console.error(`Failed to load manager route: ${name}`, err.message)
      failedRoutes.push(`manager/${name}`)
    }
  }

  // ─── Caregiver routes (/api/caregiver/*) ───
  const caregiverRoutes = ['clients', 'tasks']

  for (const name of caregiverRoutes) {
    try {
      const handler = await load(`./dist/api/caregiver/${name}.js`)
      if (handler) {
        app.all(`/api/caregiver/${name}`, route(handler))
        loadedRoutes.push(`caregiver/${name}`)
      }
    } catch (err) {
      console.error(`Failed to load caregiver route: ${name}`, err.message)
      failedRoutes.push(`caregiver/${name}`)
    }
  }

  // ─── Tasks routes (/api/tasks/*) ───
  const taskRoutes = ['complete', 'log', 'start']

  for (const name of taskRoutes) {
    try {
      const handler = await load(`./dist/api/tasks/${name}.js`)
      if (handler) {
        app.all(`/api/tasks/${name}`, route(handler))
        loadedRoutes.push(`tasks/${name}`)
      }
    } catch (err) {
      console.error(`Failed to load task route: ${name}`, err.message)
      failedRoutes.push(`tasks/${name}`)
    }
  }

  // ─── Anthropic routes (/api/anthropic/*) ───
  const anthropicRoutes = ['chat', 'summary', 'care-plan', 'report', 'family-update', 'structure-notes']

  for (const name of anthropicRoutes) {
    try {
      const handler = await load(`./dist/api/anthropic/${name}.js`)
      if (handler) {
        app.all(`/api/anthropic/${name}`, route(handler))
        loadedRoutes.push(`anthropic/${name}`)
      }
    } catch (err) {
      console.error(`Failed to load anthropic route: ${name}`, err.message)
      failedRoutes.push(`anthropic/${name}`)
    }
  }

  // ─── Copilot routes (/api/copilot/*) ───
  const copilotRoutes = ['chat', 'context']

  for (const name of copilotRoutes) {
    try {
      const handler = await load(`./dist/api/copilot/${name}.js`)
      if (handler) {
        app.all(`/api/copilot/${name}`, route(handler))
        loadedRoutes.push(`copilot/${name}`)
      }
    } catch (err) {
      console.error(`Failed to load copilot route: ${name}`, err.message)
      failedRoutes.push(`copilot/${name}`)
    }
  }

  // ─── Family catch-all route (/api/family/*) ───
  try {
    const familyHandler = await load('./dist/api/family/[[...path]].js')
    if (familyHandler) {
      app.all('/api/family', route(familyHandler))
      app.all('/api/family/*', route(familyHandler))
      loadedRoutes.push('family/catch-all')
    }
  } catch (err) {
    console.error('Failed to load family route:', err.message)
    failedRoutes.push('family/catch-all')
  }

  // ─── Route registration summary ───
  console.log(`\n[Routes] Loaded ${loadedRoutes.length} routes, ${failedRoutes.length} failed`)
  if (failedRoutes.length > 0) {
    console.warn('[Routes] FAILED routes:', failedRoutes.join(', '))
  }

  // ─── Health check ───
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      routes: { loaded: loadedRoutes.length, failed: failedRoutes.length, failedList: failedRoutes },
    })
  })

  // ─── 404 handler ───
  app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
  })

  // ─── Start server ───
  app.listen(PORT, () => {
    console.log(`CAREi API server running on port ${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/health`)
  })
}

setupRoutes().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
