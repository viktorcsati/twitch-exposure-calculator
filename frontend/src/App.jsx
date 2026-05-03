import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [recommendations, setRecommendations] = useState([])
  const [ccv, setCcv] = useState(10)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [hideNonGames, setHideNonGames] = useState(true)

  const fetchRecs = async (val = ccv) => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/recommend?ccv=${val}`)
      let data = await resp.json()
      if (hideNonGames) {
        const ignore = ["ASMR", "Chatting", "Art", "Zoos", "Pools", "Hot Tubs", "Music", "Talk Shows", "Events", "Software"]
        data = data.filter(g => !ignore.some(k => g.game_name.includes(k)))
      }
      setRecommendations(data)
      
      // Also fetch status for last update time
      const statusResp = await fetch('/api/status')
      const statusData = await statusResp.json()
      if (statusData.last_update) {
        setLastUpdate(new Date(statusData.last_update).toLocaleString())
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const triggerUpdate = async (type) => {
    setStatus(type === 'code' ? 'Updating App Code...' : 'Refreshing Metrics...')
    try {
      const url = type === 'code' ? '/api/system/update' : '/api/collect-now'
      await fetch(url, { method: 'POST' })
      if (type === 'code') {
        setTimeout(() => window.location.reload(), 45000)
      } else {
        setTimeout(() => { fetchRecs(); setStatus(null); }, 5000)
      }
    } catch (e) { setStatus("Error occurred.") }
  }

  const syncStats = async () => {
    try {
      const resp = await fetch('/api/user-stats')
      const data = await resp.json()
      if (data.ccv !== undefined) { setCcv(data.ccv); fetchRecs(data.ccv); }
    } catch (e) { alert("Check .env for channel name") }
  }

  useEffect(() => { fetchRecs() }, [hideNonGames])

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="sidebar-top">
          <div className="logo">T-EXPOSURE</div>
          
          <div className="nav-section">
            <label>CONFIG</label>
            <div className="input-card">
              <span>Avg Viewers</span>
              <input type="number" value={ccv} onChange={e => setCcv(e.target.value)} onBlur={() => fetchRecs()} />
              <button className="ghost-btn" onClick={syncStats}>Sync Twitch</button>
            </div>
          </div>

          <div className="nav-section">
            <label>FILTERS</label>
            <label className="switch">
              <input type="checkbox" checked={hideNonGames} onChange={() => setHideNonGames(!hideNonGames)} />
              Gaming Only
            </label>
          </div>

          <div className="nav-section">
            <label>DATA CONTROL</label>
            <button className="action-btn primary" onClick={() => triggerUpdate('data')}>Refresh Metrics</button>
            {lastUpdate && <div className="last-updated">Last scan: {lastUpdate}</div>}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="nav-section system">
            <label>SYSTEM SETTINGS</label>
            <button className="action-btn secondary small" onClick={() => triggerUpdate('code')}>Update App Code</button>
            <div className="system-note">v1.0.1 • Git Bridge</div>
          </div>
        </div>
      </nav>

      <main className="content">
        <header>
          <h2>Recommended Categories</h2>
          {status && <div className="status-toast">{status}</div>}
        </header>

        {loading ? <div className="loader">Analyzing...</div> : (
          <div className="grid">
            {recommendations.map(game => (
              <div key={game.game_id} className="card">
                <div className="rank" style={{ color: game.discoverability_score > 60 ? '#00ffa3' : '#ff4b4b' }}>
                  {game.discoverability_score}%
                </div>
                <img src={game.box_art_url} alt="" />
                <div className="info">
                  <h3>{game.game_name}</h3>
                  <div className="meter"><div style={{ width: `${game.saturation_percent}%` }}></div></div>
                  <div className="meta">Saturation: {game.saturation_percent}%</div>
                  <div className="meta">{game.avg_viewers_per_channel} view/chnl</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
export default App
