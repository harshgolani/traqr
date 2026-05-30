require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const redis = require('redis')
const { nanoid } = require('nanoid')
const rateLimit = require('express-rate-limit')

const app = express()
app.set('trust proxy', 1)

const PORT = process.env.PORT || 3000
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// PostgreSQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Redis
const redisClient = redis.createClient({ url: process.env.REDIS_URL })
redisClient.connect().catch(console.error)

app.use(cors({
  origin: ['https://traqr-app.netlify.app', 'http://localhost:5173']
}))
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later' }
})
app.use('/api/', limiter)

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

// Shorten URL
app.post('/api/shorten', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL is required' })

  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  try {
    const short_code = nanoid(7)
    await pool.query(
      'INSERT INTO urls (short_code, original_url) VALUES ($1, $2)',
      [short_code, url]
    )
    await redisClient.setEx(short_code, 86400, url)
    res.json({
      short_code,
      short_url: `${BASE_URL}/${short_code}`,
      original_url: url
    })
  } catch (err) {
    console.error('Shorten error:', err)
    res.status(500).json({ error: 'Failed to shorten URL' })
  }
})

// Redirect
app.get('/:short_code', async (req, res) => {
  const { short_code } = req.params
  if (short_code === 'favicon.ico') return res.status(404).end()

  try {
    const cached = await redisClient.get(short_code)
    if (cached) {
      logClick(short_code, req)
      return res.redirect(302, cached)
    }

    const result = await pool.query(
      'SELECT original_url FROM urls WHERE short_code = $1',
      [short_code]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' })
    }

    const original_url = result.rows[0].original_url
    await redisClient.setEx(short_code, 86400, original_url)
    logClick(short_code, req)
    res.redirect(302, original_url)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Get analytics for a short code
app.get('/api/analytics/:short_code', async (req, res) => {
  const { short_code } = req.params
  try {
    const urlResult = await pool.query(
      'SELECT original_url, created_at, click_count FROM urls WHERE short_code = $1',
      [short_code]
    )
    if (urlResult.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' })
    }

    const clicksResult = await pool.query(
      `SELECT
        DATE_TRUNC('day', clicked_at) as day,
        COUNT(*) as count
       FROM clicks
       WHERE short_code = $1
       GROUP BY day
       ORDER BY day DESC
       LIMIT 30`,
      [short_code]
    )

    const topReferers = await pool.query(
      `SELECT referer, COUNT(*) as count
       FROM clicks
       WHERE short_code = $1 AND referer IS NOT NULL
       GROUP BY referer
       ORDER BY count DESC
       LIMIT 5`,
      [short_code]
    )

    res.json({
      short_code,
      original_url: urlResult.rows[0].original_url,
      created_at: urlResult.rows[0].created_at,
      total_clicks: parseInt(urlResult.rows[0].click_count),
      clicks_by_day: clicksResult.rows,
      top_referers: topReferers.rows
    })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Get all URLs
app.get('/api/urls', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT short_code, original_url, created_at, click_count FROM urls ORDER BY created_at DESC LIMIT 50'
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Delete URL
app.delete('/api/urls/:short_code', async (req, res) => {
  const { short_code } = req.params
  try {
    await pool.query('DELETE FROM urls WHERE short_code = $1', [short_code])
    await pool.query('DELETE FROM clicks WHERE short_code = $1', [short_code])
    await redisClient.del(short_code)
    res.json({ deleted: short_code })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// Async click logger
async function logClick(short_code, req) {
  const user_agent = req.headers['user-agent'] || null
  const referer = req.headers['referer'] || null
  const ip_address = req.ip || null

  pool.query(
    'INSERT INTO clicks (short_code, user_agent, referer, ip_address) VALUES ($1, $2, $3, $4)',
    [short_code, user_agent, referer, ip_address]
  ).catch(console.error)

  pool.query(
    'UPDATE urls SET click_count = click_count + 1 WHERE short_code = $1',
    [short_code]
  ).catch(console.error)
}

app.listen(PORT, () => {
  console.log(`Traqr backend running on port ${PORT}`)
})
