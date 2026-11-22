import { useEffect, useRef, useState } from 'react'
import { supabase } from './subabase'

const COLORS = ['#111111', '#e53935', '#1e88e5', '#43a047', '#fbc02d', '#8e24aa']

function DrawingPreview({ drawing }) {
  return (
    <svg viewBox="0 0 1000 700" style={{ width: '100%', background: 'white', borderRadius: 10 }}>
      {Array.isArray(drawing) && drawing.map((stroke, index) => (
        <polyline
          key={index}
          points={(stroke.points || [])
            .map(point => `${point.x * 1000},${point.y * 700}`)
            .join(' ')}
          fill="none"
          stroke={stroke.color || '#111'}
          strokeWidth={stroke.width || 8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export default function App() {
  const [nickname, setNickname] = useState('')
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [roomId, setRoomId] = useState(localStorage.getItem('room_id') || '')
  const [playerId, setPlayerId] = useState(localStorage.getItem('player_id') || '')
  const [isHost, setIsHost] = useState(localStorage.getItem('is_host') === 'true')
  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState([])
  const [status, setStatus] = useState('waiting')
  const [prompt, setPrompt] = useState('')
  const [drawings, setDrawings] = useState([])
  const [strokes, setStrokes] = useState([])
  const [color, setColor] = useState('#111111')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const canvasRef = useRef(null)

  function saveRoom(result, host) {
    localStorage.setItem('room_id', result.room_id)
    localStorage.setItem('player_id', result.player_id)
    localStorage.setItem('is_host', String(host))

    setRoomId(result.room_id)
    setPlayerId(result.player_id)
    setIsHost(host)
    setRoomCode(result.code || '')
    setStatus('waiting')
    setMessage('')
  }

  async function createRoom() {
    if (!nickname.trim()) {
      setMessage('Please enter a nickname.')
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.rpc('create_room', {
      p_nickname: nickname.trim()
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result?.room_id || !result?.player_id) {
      setMessage('Could not read the room details.')
      return
    }

    saveRoom(result, true)
  }

  async function joinRoom() {
    if (!nickname.trim() || !roomCodeInput.trim()) {
      setMessage('Enter your nickname and room code.')
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.rpc('join_room', {
      p_code: roomCodeInput.trim().toUpperCase(),
      p_nickname: nickname.trim()
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result?.room_id || !result?.player_id) {
      setMessage('Could not read the room details.')
      return
    }

    saveRoom(result, false)
  }

  async function refreshRoom() {
    if (!roomId || !playerId) return

    const { data, error } = await supabase.rpc('get_room_state', {
      p_room_id: roomId,
      p_player_id: playerId
    })

    if (error) {
      setMessage(error.message)
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    const room = result?.room || result

    setRoomCode(room?.code || result?.code || '')
    setPlayers(result?.players || room?.players || [])
    setStatus(room?.status || result?.status || 'waiting')
  }

  async function refreshGame() {
    if (!roomId || !playerId) return

    const { data, error } = await supabase.rpc('get_game_state', {
      p_room_id: roomId,
      p_player_id: playerId
    })

    if (error) {
      setMessage(error.message)
      return
    }

    const game = Array.isArray(data) ? data[0] : data

    if (game) {
      setPrompt(game.prompt || '')
      setDrawings(game.drawings || [])
      setStatus(game.room_status || game.round_status || 'waiting')

      const mine = (game.drawings || []).some(
        drawing => drawing.player_id === playerId
      )
      setSubmitted(mine)
    }
  }

  async function startGame() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.rpc('start_game', {
      p_room_id: roomId,
      p_player_id: playerId
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setStrokes([])
    setSubmitted(false)
    await refreshRoom()
    await refreshGame()
  }

  async function leaveRoom() {
    setLoading(true)

    const { error } = await supabase.rpc('leave_room', {
      p_room_id: roomId,
      p_player_id: playerId
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    localStorage.removeItem('room_id')
    localStorage.removeItem('player_id')
    localStorage.removeItem('is_host')

    setRoomId('')
    setPlayerId('')
    setRoomCode('')
    setPlayers([])
    setDrawings([])
    setStrokes([])
    setStatus('waiting')
    setSubmitted(false)
    setMessage('')
  }

  function getPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    }
  }

  function startStroke(event) {
    if (submitted) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    const point = getPoint(event)
    setStrokes(previous => [
      ...previous,
      { color, width: 8, points: [point] }
    ])
  }

  function continueStroke(event) {
    if (submitted || event.buttons === 0) return
    event.preventDefault()

    const point = getPoint(event)
    setStrokes(previous => {
      if (!previous.length) return previous

      const updated = [...previous]
      const last = updated[updated.length - 1]

      updated[updated.length - 1] = {
        ...last,
        points: [...last.points, point]
      }

      return updated
    })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 1000, 700)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1000, 700)

    strokes.forEach(stroke => {
      const points = stroke.points || []
      if (!points.length) return

      ctx.beginPath()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width || 8
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(points[0].x * 1000, points[0].y * 700)

      points.forEach(point => {
        ctx.lineTo(point.x * 1000, point.y * 700)
      })

      if (points.length === 1) {
        ctx.lineTo(points[0].x * 1000 + 0.1, points[0].y * 700 + 0.1)
      }

      ctx.stroke()
    })
  }, [strokes])

  useEffect(() => {
    if (!roomId || !playerId) return

    refreshRoom()

    const timer = setInterval(() => {
      refreshRoom()
      refreshGame()
    }, 2500)

    return () => clearInterval(timer)
  }, [roomId, playerId])

  const myDrawing = drawings.find(drawing => drawing.player_id === playerId)

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#17152b',
      color: 'white',
      padding: 18,
      boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    },
    card: {
      background: '#262343',
      padding: 22,
      borderRadius: 18,
      width: '100%',
      maxWidth: 650,
      boxSizing: 'border-box',
      textAlign: 'center'
    },
    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding: 14,
      margin: '8px 0',
      borderRadius: 9,
      border: '1px solid #625c87',
      background: '#17152b',
      color: 'white',
      fontSize: 16
    },
    button: {
      padding: '12px 16px',
      margin: 5,
      border: 0,
      borderRadius: 9,
      background: '#8067ff',
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
      cursor: 'pointer'
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>🎨 Doodle Chaos</h1>

        {!roomId ? (
          <>
            <p>Create a room or join your friends.</p>
            <input
              style={styles.input}
              placeholder="Your nickname"
              maxLength={18}
              value={nickname}
              onChange={event => setNickname(event.target.value)}
            />
            <button style={styles.button} onClick={createRoom} disabled={loading}>
              Create Room
            </button>
            <hr />
            <input
              style={styles.input}
              placeholder="Room code"
              value={roomCodeInput}
              onChange={event => setRoomCodeInput(event.target.value)}
            />
            <button style={styles.button} onClick={joinRoom} disabled={loading}>
              Join Room
            </button>
          </>
        ) : status !== 'playing' ? (
          <>
            <h2>Room: {roomCode || 'Loading...'}</h2>
            <p>Share this code with your friends.</p>
            <h3>Players ({players.length})</h3>
            {players.map((player, index) => (
              <p key={player.id || index}>
                {player.nickname || player.name}
                {player.id === playerId ? ' (You)' : ''}
              </p>
            ))}
            {isHost ? (
              <button style={styles.button} onClick={startGame} disabled={loading}>
                Start Game
              </button>
            ) : (
              <p>Waiting for the host to start...</p>
            )}
            <br />
            <button style={{ ...styles.button, background: '#514c70' }} onClick={leaveRoom}>
              Leave Room
            </button>
          </>
        ) : (
          <>
            <h2>✏️ Your drawing challenge</h2>
            <div style={{
              background: '#3a345e',
              padding: 14,
              borderRadius: 12,
              fontSize: 21,
              fontWeight: 'bold',
              marginBottom: 12
            }}>
              {prompt || 'Loading your prompt...'}
            </div>

            {!submitted ? (
              <>
                <div style={{
                  display: 'flex',
                  gap: 7,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  marginBottom: 10
                }}>
                  {COLORS.map(item => (
                    <button
                      key={item}
                      aria-label={`Choose ${item}`}
                      onClick={() => setColor(item)}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: item,
                        border: color === item ? '4px solid white' : '2px solid #aaa',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                  <button
                    style={{ ...styles.button, background: '#514c70' }}
                    onClick={() => setColor('#ffffff')}
                  >
                    Eraser
                  </button>
                  <button
                    style={{ ...styles.button, background: '#514c70' }}
                    onClick={() => setStrokes([])}
                  >
                    Clear
                  </button>
                </div>

                <canvas
                  ref={canvasRef}
                  width={1000}
                  height={700}
                  onPointerDown={startStroke}
                  onPointerMove={continueStroke}
                  style={{
                    width: '100%',
                    aspectRatio: '10 / 7',
                    background: 'white',
                    borderRadius: 12,
                    touchAction: 'none',
                    display: 'block',
                    cursor: 'crosshair'
                  }}
                />

                <button
                  style={{ ...styles.button, width: '100%', marginTop: 14 }}
                  disabled={loading || strokes.length === 0}
                  onClick={async () => {
                    setLoading(true)
                    const { error } = await supabase.rpc('submit_drawing', {
                      p_room_id: roomId,
                      p_player_id: playerId,
                      p_drawing: strokes
                    })
                    setLoading(false)

                    if (error) {
                      setMessage(error.message)
                    } else {
                      setSubmitted(true)
                      setMessage('Drawing submitted!')
                      await refreshGame()
                    }
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Drawing'}
                </button>
              </>
            ) : (
              <p>✅ Drawing submitted! Waiting for everyone else...</p>
            )}

            <h2>🎨 Drawings Gallery</h2>
            {drawings.length === 0 ? (
              <p>No drawings submitted yet.</p>
            ) : (
              drawings.map((drawing, index) => (
                <div
                  key={drawing.player_id || index}
                  style={{
                    background: '#3a345e',
                    padding: 12,
                    borderRadius: 12,
                    margin: '12px 0'
                  }}
                >
                  <h3>{drawing.nickname}</h3>
                  <DrawingPreview drawing={drawing.drawing} />
                </div>
              ))
            )}

            <button
              style={{ ...styles.button, background: '#514c70' }}
              onClick={leaveRoom}
            >
              Leave Room
            </button>
          </>
        )}

        {message && (
          <p role="status" style={{ color: '#ffaaaa', overflowWrap: 'anywhere' }}>
            {message}
          </p>
        )}
      </section>
    </main>
  )
}
