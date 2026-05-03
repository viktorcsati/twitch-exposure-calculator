import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [recommendations, setRecommendations] = useState([])
  const [ccv, setCcv] = useState(10)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [hideNonGames, setHideNonGames] = useState(true)

  const nonGameKeywords = ["ASMR", "Chatting", "Art", "Zoos", "Pools", "Hot Tubs", "Music", "Talk Shows", "Events", "Software", "Just Chatting"]

  const fetchRecs = async (currentCcv) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/recommend?ccv=${currentCcv || ccv}`)
      let data = await response.json()
      if (hideNonGames) {
        data = data.filter(game => !nonGameKeywords.some(k => game.game_name.toLowerCase().includes(k.toLowerCase())))
      }
      setRecommendations(data)
    } catch (error) {
      console.error("Failed to fetch:", error)
    }
    setLoading(false)
  }

  const handleUpdateData = async () => {
    setUpdating(true)
    try {
      const response = await fetch('/api/collect-now', { method: 'POST' })
      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        await fetchRecs()
      }
    } catch (error) {
      console.error("Update failed:", error)
    }
    setUpdating(false)
  }

  const syncCcv = async () => {
    try {
      const resp = await fetch('/api/user-stats')
      const stats = await resp.json()
      if (stats.ccv !== undefined) { 
        setCcv(stats.ccv)
        fetchRecs(stats.ccv)
      }
    } catch (e) { 
      console.error("Sync failed", e)
    }
  }

  useEffect(() => {
    fetchRecs()
  }, [hideNonGames])

  return (
    <div className="dashboard-root">
      <header className="main-header">
        <div className="header-left">
          <h1>Twitch Exposure <span className="highlight">Calculator</span></h1>
          <div className="header-actions">
            <button 
              className="refresh-btn" 
              onClick={handleUpdateData}
              disabled={updating}
            >
              {updating ? 'Updating...' : 'Refresh Database'}
            </button>
            <label className="filter-toggle">
              <input 
                type="checkbox" 
                checked={hideNonGames} 
                onChange={() => setHideNonGames(!hideNonGames)} 
              />
              Gaming Only
            </label>
          </div>
        </div>
        
        <div className="header-right">
          <div className="stats-panel">
            <label>Your Avg Viewers:</label>
            <div className="ccv-controls">
              <input 
                type="number" 
                value={ccv} 
                onChange={(e) => setCcv(parseInt(e.target.value) || 0)}
                onBlur={() => fetchRecs()}
              />
              <button className="sync-btn" onClick={syncCcv}>Sync</button>
            </div>
            <p className="system-note">Terminal: <code>git pull</code> for app updates</p>
          </div>
        </div>
      </header>

      {loading && !updating ? (
        <div className="status-msg">Analyzing Twitch...</div>
      ) : (
        <div className="results-grid">
          {recommendations.length === 0 ? (
             <div className="status-msg">
               No data. Click Refresh to begin.
             </div>
          ) : (
            recommendations.map((game) => (
              <div key={game.game_id} className="game-card">
                <div className="score-label" style={{ 
                  backgroundColor: game.discoverability_score > 70 ? '#2ecc71' : 
                                   game.discoverability_score > 40 ? '#f1c40f' : '#e74c3c' 
                }}>
                  {game.discoverability_score}%
                </div>
                <div className="art-wrapper">
                  <img src={game.box_art_url} alt={game.game_name} />
                </div>
                <div className="card-content">
                  <h3>{game.game_name}</h3>
                  <div className="stat-row">
                    <span>Saturation: {game.saturation_percent}%</span>
                    <div className="meter-bg">
                      <div className="meter-fill" style={{ width: `${game.saturation_percent}%`, backgroundColor: game.saturation_percent > 80 ? '#e74c3c' : '#3498db' }}></div>
                    </div>
                  </div>
                  <div className="sub-stats">
                    {game.avg_viewers_per_channel} viewers/channel
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default App
