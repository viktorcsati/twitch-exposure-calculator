import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [recommendations, setRecommendations] = useState([])
  const [ccv, setCcv] = useState(10)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [hideNonGames, setHideNonGames] = useState(true)

  // List of keywords to identify non-game categories
  const nonGameKeywords = ["ASMR", "Chatting", "Art", "Zoos", "Pools", "Hot Tubs", "Music", "Talk Shows", "Events", "Software"]

  const fetchRecs = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/recommend?ccv=${ccv}`)
      let data = await response.json()
      
      if (hideNonGames) {
        data = data.filter(game => !nonGameKeywords.some(k => game.game_name.includes(k)))
      }
      
      setRecommendations(data)
    } catch (error) {
      console.error("Failed to fetch:", error)
    }
    setLoading(false)
  }

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      const response = await fetch('/api/collect-now', { method: 'POST' })
      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 3000))
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
      }
    } catch (e) {
      console.error("Sync failed", e)
    }
  }

  useEffect(() => {
    fetchRecs()
  }, [ccv, hideNonGames])

  return (
    <div className="dashboard">
      <header>
        <div className="brand">
          <h1>Twitch Exposure Calculator</h1>
          <div className="button-group">
            <button 
              className={`update-btn ${updating ? 'spinning' : ''}`} 
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? 'Fetching...' : 'Refresh Database'}
            </button>
            <label className="toggle">
              <input 
                type="checkbox" 
                checked={hideNonGames} 
                onChange={() => setHideNonGames(!hideNonGames)} 
              />
              Hide Non-Games (Zoos, Art, etc.)
            </label>
          </div>
        </div>
        
        <div className="controls">
          <label>Target CCV:</label>
          <div className="ccv-input-group">
            <input 
              type="number" 
              value={ccv} 
              onChange={(e) => setCcv(parseInt(e.target.value) || 0)} 
            />
            <button onClick={syncCcv} title="Sync with my Twitch stats">Sync</button>
          </div>
          <p className="hint">We use this to find games where you'd be in the top rows.</p>
        </div>
      </header>

      {loading && !updating ? (
        <div className="loader">Analyzing Twitch Categories...</div>
      ) : (
        <div className="game-grid">
          {recommendations.length === 0 && !loading ? (
             <div className="no-data">
               <p>No data found or all categories filtered out.</p>
               <button onClick={handleUpdate}>Fetch Data</button>
             </div>
          ) : (
            recommendations.map((game) => (
              <div key={game.game_id} className="game-card">
                <div className="score-badge" style={{ 
                  backgroundColor: game.discoverability_score > 70 ? '#2ecc71' : 
                                   game.discoverability_score > 40 ? '#f1c40f' : '#e74c3c' 
                }}>
                  {game.discoverability_score}%
                </div>
                <img src={game.box_art_url} alt={game.game_name} />
                <div className="game-info">
                  <h3>{game.game_name}</h3>
                  <div className="metric">
                    <span>Saturation: {game.saturation_percent}%</span>
                    <div className="bar-bg">
                      <div className="bar-fill" style={{ width: `${game.saturation_percent}%`, backgroundColor: game.saturation_percent > 80 ? '#e74c3c' : '#3498db' }}></div>
                    </div>
                  </div>
                  <p className="vpc">Avg {game.avg_viewers_per_channel} view/channel</p>
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
