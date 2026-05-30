import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './App.css'

function timeAgo(dateStr) {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function truncate(str, n = 50) {
  return str.length > n ? str.slice(0, n) + '...' : str
}

export default function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [urls, setUrls] = useState([])
  const [analyticsData, setAnalyticsData] = useState({})
  const [openAnalytics, setOpenAnalytics] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchUrls() }, [])

  async function fetchUrls() {
    try {
      const r = await fetch('https://traqr-production-fbdd.up.railway.app')
      const data = await r.json()
      setUrls(data)
    } catch (e) {
      console.error('Failed to fetch URLs', e)
    }
  }

  async function handleShorten() {
    if (!url.trim() || loading) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const r = await fetch('http://localhost:3000/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.error || 'Failed to shorten URL')
      }
      const data = await r.json()
      setResult(data)
      fetchUrls()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalytics(short_code) {
    if (openAnalytics === short_code) {
      setOpenAnalytics(null)
      return
    }
    try {
      const r = await fetch(`http://localhost:3000/api/analytics/${short_code}`)
      const data = await r.json()
      setAnalyticsData(prev => ({ ...prev, [short_code]: data }))
      setOpenAnalytics(short_code)
    } catch (e) {
      console.error('Failed to fetch analytics', e)
    }
  }

  async function handleDelete(short_code) {
    try {
      await fetch(`http://localhost:3000/api/urls/${short_code}`, { method: 'DELETE' })
      setUrls(prev => prev.filter(u => u.short_code !== short_code))
      if (openAnalytics === short_code) setOpenAnalytics(null)
    } catch (e) {
      console.error('Failed to delete', e)
    }
  }

  async function handleCopy(text) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleShorten()
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Traqr</h1>
        <p>URL shortener with click analytics</p>
      </header>

      <div className="section">
        <div className="shorten-row">
          <input
            type="url"
            placeholder="https://example.com/your-long-url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="btn-primary"
            onClick={handleShorten}
            disabled={loading || !url.trim()}
          >
            {loading ? 'Shortening…' : 'Shorten →'}
          </button>
        </div>

        {error && <p className="error-msg">{error}</p>}

        {result && (
          <div className="result-box">
            <a href={result.short_url} target="_blank" rel="noopener noreferrer">
              {result.short_url}
            </a>
            <button
              className={`btn-copy${copied ? ' copied' : ''}`}
              onClick={() => handleCopy(result.short_url)}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <div className="section">
        <p className="section-title">Your URLs</p>

        {urls.length === 0 ? (
          <p className="empty-list">No URLs yet. Shorten one above.</p>
        ) : (
          <div className="url-list">
            {urls.map(u => {
              const analytics = analyticsData[u.short_code]
              const isOpen = openAnalytics === u.short_code

              const chartData = analytics?.clicks_by_day?.map(d => ({
                day: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                clicks: parseInt(d.count)
              })) ?? []

              return (
                <div key={u.short_code} className="url-row">
                  <div className="url-row-main">
                    <span className="url-code">{u.short_code}</span>
                    <span className="url-original" title={u.original_url}>
                      {truncate(u.original_url)}
                    </span>
                    <div className="url-meta">
                      <span className="url-clicks">{u.click_count} clicks</span>
                      <span className="url-date">{timeAgo(u.created_at)}</span>
                      <button
                        className={`btn-sm${isOpen ? ' active' : ''}`}
                        onClick={() => handleAnalytics(u.short_code)}
                      >
                        Analytics
                      </button>
                      <button
                        className="btn-sm danger"
                        onClick={() => handleDelete(u.short_code)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isOpen && analytics && (
                    <div className="analytics-panel">
                      <div className="analytics-total">
                        <span>{analytics.total_clicks}</span>total clicks
                      </div>

                      {chartData.length > 0 && (
                        <>
                          <p className="analytics-label">Clicks by day</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                              <XAxis
                                dataKey="day"
                                stroke="#7a6a65"
                                tick={{ fill: '#7a6a65', fontSize: 12 }}
                              />
                              <YAxis
                                stroke="#7a6a65"
                                tick={{ fill: '#7a6a65', fontSize: 12 }}
                                allowDecimals={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: '#111',
                                  border: '1px solid #1e1614',
                                  color: '#e8e0dc'
                                }}
                              />
                              <Bar dataKey="clicks" fill="#c4a090" radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </>
                      )}

                      <p className="analytics-label">Top referers</p>
                      {analytics.top_referers?.length > 0 ? (
                        <div className="referers-list">
                          {analytics.top_referers.map((ref, i) => (
                            <div key={i} className="referer-row">
                              <span>{ref.referer}</span>
                              <span>{ref.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-list">No referer data</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
