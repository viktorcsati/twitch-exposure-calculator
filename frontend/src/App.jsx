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
  const [pinnedGames, setPinnedGames] = useState(() => {
    const saved = localStorage.getItem('pinnedGames')
    return saved ? JSON.parse(saved) : []
  })
  const [isSearching, setIsSearching] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Robustly handle Twitch box art URLs
  const getBoxArtUrl = (url, width = 285, height = 380) => {
    if (!url) return 'https://static-cdn.jtvnw.net/ttv-static/404_boxart-600x800.jpg'
    return url
      .replace('{width}x{height}', `${width}x${height}`)
      .replace('{width}', width)
      .replace('{height}', height)
      .replace(/\d+x\d+/, `${width}x${height}`)
  }

  // Persist pinned games
  useEffect(() => {
    localStorage.setItem('pinnedGames', JSON.stringify(pinnedGames))
  }, [pinnedGames])

  // Debounced search for suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        try {
          const resp = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`)
          const data = await resp.json()
          setSuggestions(data)
          setShowSuggestions(true)
        } catch (e) { console.error(e) }
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const selectGame = async (game) => {
    setIsSearching(true)
    setShowSuggestions(false)
    try {
      const resp = await fetch(`/api/search?id=${game.id}&q=${encodeURIComponent(game.name)}&ccv=${ccv}`)
      const data = await resp.json()
      setPinnedGames(prev => {
        const exists = prev.some(g => g.game_id === data.game_id)
        if (exists) return prev
        return [data, ...prev]
      })
      setSearchQuery('')
    } catch (e) { alert("Error calculating score.") }
    setIsSearching(false)
  }

  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return
    
    // Use first suggestion if available, else generic search
    if (suggestions.length > 0) {
      selectGame(suggestions[0])
    } else {
      setIsSearching(true)
      try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&ccv=${ccv}`)
        if (!resp.ok) throw new Error("Game not found")
        const data = await resp.json()
        setPinnedGames(prev => [data, ...prev])
        setSearchQuery('')
      } catch (e) { alert("Game not found.") }
      setIsSearching(false)
    }
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
            <div className="search-container">
              <form onSubmit={handleSearch} className="input-card">
                <input 
                  type="text" 
                  placeholder="Game name..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                />
                <button type="submit" className="ghost-btn" disabled={isSearching}>
                  {isSearching ? '...' : 'Pin Score'}
                </button>
              </form>
              {showSuggestions && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map(g => (
                    <div key={g.id} className="suggestion-item" onClick={() => selectGame(g)}>
                      <img src={getBoxArtUrl(g.box_art_url, 30, 40)} alt="" />
                      <span>{g.name}</span>
                    </div>
                  ))}
                </div>
              )}
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
                  <img src={getBoxArtUrl(game.box_art_url)} alt="" />
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
