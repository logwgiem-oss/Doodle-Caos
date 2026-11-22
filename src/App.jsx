import { useEffect, useRef, useState } from 'react'
import { supabase } from './subabase'

function DrawingBoard({ strokes, setStrokes, color, size, disabled }) {
  const svgRef = useRef(null)

  function getPoint(event) {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    }
  }

  function startDrawing(event) {
    if (disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    setStrokes(previous => [
      ...previous,
      { color, size, points: [getPoint(event)] }
    ])
  }

  function continueDrawing(event) {
    if (disabled || !event.buttons) return
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

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      onPointerDown={startDrawing}
      onPointerMove={continueDrawing}
      style={{
        width: '100%',
        height: 'auto',
        aspectRatio: '5 / 3',
        background: 'white',
        border: '2px solid #222',
        borderRadius: 12,
        touchAction: 'none',
        display: 'block'
      }}
    >
      {strokes.map((stroke, index) => (
        <polyline
          key={index}
          points={stroke.points
            .map(point => `${point.x * 1000},${point.y * 600}`)
            .join(' ')}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.size * 5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

function DrawingPreview({ strokes }) {
  return (
    <svg
      viewBox="0 0 1000 600"
      style={{
        width: '100%',
        maxWidth: 350,
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: 10
      }}
    >
      {(strokes || []).map((stroke, index) => (
        <polyline
          key={index}
          points={(stroke.points || [])
            .map(point => `${point.x * 1000},${point.y * 600}`)
            .join(' ')}
          fill="none"
          stroke={stroke.color || '#111'}
          strokeWidth={(stroke.size || 2) * 5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export default function App() {
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [room, setRoom] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [players, setPlayers] = useState([])
  const [status, setStatus] = useState('waiting')
  const [phase, setPhase] = useState('prompt')
  const [phaseEndsAt, setPhaseEndsAt] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [drawings, setDrawings] = useState([])
  const [strokes, setStrokes] = useState([])
  const [color, setColor] = useState('#111111')
  const [size, setSize] = useState(3)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isHost = room?.host_player_id === playerId

  async function createRoom() {
    if (!nickname.trim()) {
      setMessage('Please enter a nickname first!')
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

    setPlayerId(data.player_id)
    setRoom({
      id: data.room_id,
      code: data.code,
      host_player_id: data.player_id
    })
    setStatus('waiting')
    setMessage('Room created! Share the code with your friends.')
  }

  async function joinRoom() {
    if (!nickname.trim() || !roomCode.trim()) {
      setMessage('Enter your nickname and room code first!')
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.rpc('join_room', {
      p_nickname: nickname.trim(),
      p_code: roomCode.trim().toUpperCase()
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setPlayerId(data.player_id)
    setRoom({
      id: data.room_id,
      code: roomCode.trim().toUpperCase()
    })
    setStatus('waiting')
    setMessage('You joined the room!')
  }

  async function refreshRoom() {
    if (!room?.id || !playerId) return

    const { data, error } = await supabase.rpc('get_room_state', {
      p_room_id: room.id,
      p_player_id: playerId
    })

    if (error || !data) return

    const roomData = data.room || data
    setPlayers(data.players || [])

    if (roomData.host_player_id) {
      setRoom(previous => ({
        ...previous,
        ...roomData,
        id: room.id,
        code: previous.code
      }))
    }

    if (roomData.status) {
      setStatus(roomData.status)
    }
  }

  async function refreshGame() {
    if (!room?.id || !playerId) return

    const { data, error } = await supabase.rpc('get_game_state', {
      p_room_id: room.id,
      p_player_id: playerId
    })

    if (error || !data) return

    setPrompt(data.prompt || '')
    setDrawings(data.drawings || [])
    setPhase(data.phase || 'prompt')
    setPhaseEndsAt(data.phase_ends_at || null)

    if (data.room_status === 'finished' || data.phase === 'finished') {
      setStatus('finished')
    } else if (data.room_status) {
      setStatus(data.room_status)
    }

    const myDrawing = (data.drawings || []).some(
      drawing => drawing.player_id === playerId
    )
    setSubmitted(myDrawing)
  }

  async function startGame() {
    if (!room?.id || !playerId) return

    setLoading(true)
    setMessage('')

    const { error } = await supabase.rpc('start_game', {
      p_room_id: room.id,
      p_player_id: playerId
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setStrokes([])
    setSubmitted(false)
    await refreshGame()
  }

  async function saveCustomPrompt() {
    if (!customPrompt.trim()) {
      setMessage('Enter a prompt first!')
      return
    }

    const { error } = await supabase.rpc('set_custom_prompt', {
      p_room_id: room.id,
      p_player_id: playerId,
      p_prompt: customPrompt.trim()
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Prompt updated!')
    setCustomPrompt('')
    await refreshGame()
  }

  async function submitDrawing() {
    if (submitted || phase !== 'drawing' || secondsLeft <= 0) return

    setLoading(true)

    const { error } = await supabase.rpc('submit_drawing', {
      p_room_id: room.id,
      p_player_id: playerId,
      p_drawing: strokes
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setSubmitted(true)
    setMessage('Drawing submitted!')
    await refreshGame()
  }

  async function leaveRoom() {
    if (room?.id && playerId) {
      await supabase.rpc('leave_room', {
        p_room_id: room.id,
        p_player_id: playerId
      })
    }

    setRoom(null)
    setPlayerId(null)
    setPlayers([])
    setStatus('waiting')
    setPhase('prompt')
    setPhaseEndsAt(null)
    setDrawings([])
    setStrokes([])
    setSubmitted(false)
    setMessage('')
  }

  // Refresh the room and game state for everyone.
  useEffect(() => {
    if (!room?.id || !playerId) return

    refreshRoom()
    refreshGame()

    const interval = setInterval(() => {
      refreshRoom()
      refreshGame()
    }, 1500)

    return () => clearInterval(interval)
  }, [room?.id, playerId])

  // Update the visible countdown every second.
  useEffect(() => {
    function updateTimer() {
      if (!phaseEndsAt) {
        setSecondsLeft(0)
        return
      }

      const remaining = Math.max(
        0,
        Math.ceil((new Date(phaseEndsAt).getTime() - Date.now()) / 1000)
      )

      setSecondsLeft(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [phaseEndsAt])

  const buttonStyle = {
    padding: '12px 18px',
    borderRadius: 10,
    border: 'none',
    background: '#222',
    color: 'white',
    fontWeight: 'bold',
    cursor: 'pointer',
    margin: 4
  }

  const cardStyle = {
    background: 'white',
    color: '#222',
    padding: 20,
    borderRadius: 16,
    margin: '16px auto',
    maxWidth: 650,
    boxShadow: '0 4px 18px #0001'
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f3edff',
      color: '#222',
      padding: 18,
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center'
    }}>
      <header>
        <h2>✳ DOODLE CHAOS</h2>
        <p>THE DRAWING PARTY GAME</p>
      </header>

      {!room && (
        <>
          <section style={cardStyle}>
            <p>DRAW · PASS · LAUGH</p>
            <h1>Good ideas.<br /><em>Terrible</em> drawings.</h1>
            <p>Grab your friends, make some drawings and see how chaotic things get.</p>

            <input
              placeholder="Your nickname"
              value={nickname}
              onChange={event => setNickname(event.target.value)}
              maxLength={18}
              style={{ padding: 12, width: '85%', margin: 8 }}
            />

            <button
              style={buttonStyle}
              onClick={createRoom}
              disabled={loading}
            >
              {loading ? 'PLEASE WAIT...' : '+ CREATE A ROOM'}
            </button>

            <div style={{ marginTop: 15 }}>
              <input
                placeholder="ROOM CODE"
                value={roomCode}
                onChange={event => setRoomCode(event.target.value.toUpperCase())}
                maxLength={5}
                style={{ padding: 12, width: 130 }}
              />
              <button
                style={buttonStyle}
                onClick={joinRoom}
                disabled={loading}
              >
                JOIN ↗
              </button>
            </div>

            {message && <p role="status">{message}</p>}
          </section>
        </>
      )}

      {room && (
        <section style={cardStyle}>
          <h2>ROOM: {room.code}</h2>
          <p>Share this code with your friends!</p>

          {status === 'waiting' && (
            <>
              <h3>Players in the room</h3>
              {players.map(player => (
                <p key={player.id}>🎨 {player.nickname}</p>
              ))}

              {players.length === 0 && <p>Waiting for players...</p>}

              {isHost ? (
                <button
                  style={buttonStyle}
                  onClick={startGame}
                  disabled={loading || players.length < 1}
                >
                  {loading ? 'STARTING...' : 'START GAME'}
                </button>
              ) : (
                <p>Waiting for the host to start the game...</p>
              )}
            </>
          )}

          {status === 'playing' && (
            <>
              <h2>
                {phase === 'prompt' ? 'GET READY!' : 'DRAW YOUR PROMPT!'}
              </h2>

              <div style={{
                fontSize: 42,
                fontWeight: 'bold',
                margin: 12,
                color: secondsLeft <= 10 ? '#d33' : '#5b35a5'
              }}>
                {secondsLeft}s
              </div>

              <h2>{prompt}</h2>

              {phase === 'prompt' && (
                <>
                  <p>Remember the prompt! Drawing starts when the timer ends.</p>

                  {isHost && (
                    <div style={{ marginTop: 20 }}>
                      <input
                        placeholder="Write your own prompt"
                        value={customPrompt}
                        onChange={event => setCustomPrompt(event.target.value)}
                        style={{ padding: 10, width: '70%' }}
                      />
                      <button
                        style={buttonStyle}
                        onClick={saveCustomPrompt}
                      >
                        SET PROMPT
                      </button>
                    </div>
                  )}
                </>
              )}

              {phase === 'drawing' && (
                <>
                  <p>Make your drawing before time runs out!</p>

                  <DrawingBoard
                    strokes={strokes}
                    setStrokes={setStrokes}
                    color={color}
                    size={size}
                    disabled={submitted || secondsLeft <= 0}
                  />

                  <div style={{ margin: 12 }}>
                    {['#111111', '#e53935', '#1976d2', '#2e9d50', '#f5a623', '#9c27b0'].map(c => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: c,
                          border: color === c ? '4px solid #888' : '2px solid white',
                          margin: 4
                        }}
                        aria-label={`Choose ${c}`}
                      />
                    ))}
                  </div>

                  <div>
                    <button style={buttonStyle} onClick={() => setColor('white')}>
                      ERASER
                    </button>
                    <button style={buttonStyle} onClick={() => setStrokes([])}>
                      CLEAR
                    </button>
                  </div>

                  <div style={{ margin: 12 }}>
                    <label>Brush size </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={size}
                      onChange={event => setSize(Number(event.target.value))}
                    />
                  </div>

                  <button
                    style={buttonStyle}
                    onClick={submitDrawing}
                    disabled={loading || submitted || secondsLeft <= 0}
                  >
                    {submitted ? 'DRAWING SUBMITTED ✓' : loading ? 'SUBMITTING...' : 'SUBMIT DRAWING'}
                  </button>

                  {submitted && <p>Waiting for the timer to finish...</p>}
                </>
              )}
            </>
          )}

          {status === 'finished' && (
            <>
              <h2>🎉 THE DRAWINGS ARE IN!</h2>
              <p>Here's what everyone created.</p>

              {drawings.map((drawing, index) => (
                <div key={index} style={{
                  margin: '20px auto',
                  padding: 12,
                  background: '#f5f2fa',
                  borderRadius: 12
                }}>
                  <h3>{drawing.nickname}</h3>
                  <DrawingPreview strokes={drawing.drawing} />
                </div>
              ))}

              {drawings.length === 0 && (
                <p>No drawings were submitted this round.</p>
              )}

              {isHost && (
                <button style={buttonStyle} onClick={startGame}>
                  PLAY ANOTHER ROUND
                </button>
              )}
            </>
          )}

          {message && <p role="status">{message}</p>}

          <button
            style={{ ...buttonStyle, background: '#777', marginTop: 20 }}
            onClick={leaveRoom}
          >
            LEAVE ROOM
          </button>
        </section>
      )}

      <footer style={{ marginTop: 30 }}>
        MADE FOR FRIENDS, NOT ARTISTS.
      </footer>
    </main>
  )
}
