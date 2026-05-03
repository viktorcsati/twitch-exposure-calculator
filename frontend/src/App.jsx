import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [recommendations, setRecommendations] = useState([])
  const [ccv, setCcv] = useState(0) // Start at 0, will be synced
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [version, setVersion] = useState('...')
  const [hideNonGames, setHideNonGames] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [pinnedGames, setPinnedGames] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&ccv=${ccv}`)
      if (!resp.ok) throw new Error("Game not found")
      const data = await resp.json()
      
      setPinnedGames(prev => {
        const exists = prev.some(g => g.game_id === data.game_id)
        if (exists) return prev
        return [data, ...prev]
      })
      setSearchQuery('')
    } catch (e) { alert("Game not found or error occurred.") }
    setIsSearching(false)
  }

  const unpinGame = (id) => {
    setPinnedGames(prev => prev.filter(g => g.game_id !== id))
  }

  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp + "Z"); // Ensure it's treated as UTC
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    return date.toLocaleString();
  }

  const fetchStatus = async () => {
    try {
      const resp = await fetch('/api/status')
      const data = await resp.json()
      if (data.last_update) setLastUpdate(formatLastUpdate(data.last_update))
      if (data.version) setVersion(data.version)
    } catch (e) { console.error("Status check failed", e) }
  }

  const fetchRecs = async (val = ccv) => {
    setLoading(true)
    try {
      const resp = await fetch(`/api/recommend?ccv=${val}`)
      if (!resp.ok) throw new Error("Failed to fetch recs")
      let data = await resp.json()
      
      if (hideNonGames) {
        const blacklist = ["Just Chatting", "Pools, Hot Tubs", "Talk Shows", "ASMR", "Art", "Zoos, Animals", "Music", "Software", "Makers & Crafting", "Beauty", "Events", "Creative"]
        data = data.filter(g => {
          const name = g.game_name.toLowerCase();
          return !blacklist.some(k => {
            const key = k.toLowerCase();
            // Match if category name is exactly the keyword OR contains the keyword as a distinct concept
            if (name === key) return true;
            if (name.includes(` ${key}`) || name.includes(`${key} `)) return true;
            // Special cases for common Twitch categories
            if (key === "art" && name === "art") return true; 
            if (key === "software" && name.includes("software")) return true;
            return false;
          });
        })
      }
      setRecommendations(data)
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
        setTimeout(() => { fetchRecs(); fetchStatus(); setStatus(null); }, 5000)
      }
    } catch (e) { setStatus("Error occurred.") }
  }

  const syncCcv = async () => {
    try {
      const resp = await fetch('/api/user-stats')
      const data = await resp.json()
      if (data.ccv !== undefined) { 
        setCcv(data.ccv)
        return data.ccv
      }
    } catch (e) { console.error("Sync failed", e) }
    return ccv
  }

  // Initial load
  useEffect(() => {
    const init = async () => {
      fetchStatus()
      const currentCcv = await syncCcv()
      fetchRecs(currentCcv)
    }
    init()
  }, [])

  // Reaction to state changes
  useEffect(() => {
    fetchRecs()
  }, [hideNonGames])

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="sidebar-top">
          <div className="logo">T-EXPOSURE</div>
          
          <div className="nav-section">
            <label>CONFIG</label>
            <div className="input-card">
              <span>Avg Viewers</span>
              <input type="number" value={ccv} onChange={e => setCcv(parseInt(e.target.value) || 0)} onBlur={() => fetchRecs()} />
              <button className="ghost-btn" onClick={syncCcv}>Sync Twitch</button>
            </div>
          </div>

          <div className="nav-section">
            <label>SEARCH GAME</label>
            <form onSubmit={handleSearch} className="input-card">
              <input 
                type="text" 
                placeholder="Game name..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="ghost-btn" disabled={isSearching}>
                {isSearching ? '...' : 'Pin Score'}
              </button>
            </form>
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
            <div className="system-note">v{version} • Git Bridge</div>
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
            {[...pinnedGames, ...recommendations.filter(r => !pinnedGames.some(p => p.game_id === r.game_id))].length === 0 ? (
              <div className="no-data-msg">
                <h3>No categories found.</h3>
                <p>Try turning off "Gaming Only" or clicking "Refresh Metrics".</p>
              </div>
            ) : (
              [...pinnedGames, ...recommendations.filter(r => !pinnedGames.some(p => p.game_id === r.game_id))].map(game => (
                <div key={game.game_id} className="card">
                  {pinnedGames.some(p => p.game_id === game.game_id) && (
                    <button className="unpin-btn" onClick={() => unpinGame(game.game_id)}>×</button>
                  )}
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
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
export default App
