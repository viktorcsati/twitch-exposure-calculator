import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [recommendations, setRecommendations] = useState([])
  const [ccv, setCcv] = useState(10)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const fetchRecs = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/recommend?ccv=${ccv}`)
      const data = await response.json()
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
        // Wait a few seconds for Twitch to respond and DB to save
        await new Promise(resolve => setTimeout(resolve, 5000))
        await fetchRecs()
      }
    } catch (error) {
      console.error("Update failed:", error)
    }
    setUpdating(false)
  }

  useEffect(() => {
    fetchRecs()
  }, [ccv])

  return (
    <div className="dashboard">
      <header>
        <div className="brand">
          <h1>Twitch Exposure Calculator</h1>
          <button 
            className={`update-btn ${updating ? 'spinning' : ''}`} 
            onClick={handleUpdate}
            disabled={updating}
          >
            {updating ? 'Fetching Twitch Data...' : 'Refresh Data Now'}
          </button>
        </div>
        <div className="controls">
          <label>Your Avg Viewers: <strong>{ccv}</strong></label>
          <input 
            type="range" 
            min="0" 
            max="500" 
            value={ccv} 
            onChange={(e) => setCcv(e.target.value)} 
          />
        </div>
      </header>

      {loading && !updating ? (
        <div className="loader">Analyzing Twitch Categories...</div>
      ) : (
        <div className="game-grid">
          {recommendations.length === 0 && !loading ? (
             <div className="no-data">
               <p>No data found in database.</p>
               <button onClick={handleUpdate}>Fetch Initial Data</button>
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
                    <span>Saturation:</span>
                    <div className="bar-bg">
                      <div className="bar-fill" style={{ width: `${game.saturation_percent}%`, backgroundColor: game.saturation_percent > 80 ? '#e74c3c' : '#3498db' }}></div>
                    </div>
                  </div>
                  <p>Avg {game.avg_viewers_per_channel} viewers/channel</p>
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
