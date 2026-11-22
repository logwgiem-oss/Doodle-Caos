import { useEffect, useRef, useState } from 'react'
import { supabase } from './subabase'

const button = {
  padding: '12px 18px',
  borderRadius: 10,
  border: 0,
  background: '#292039',
  color: 'white',
  fontWeight: 'bold',
  cursor: 'pointer',
  margin: 5
}

function DrawingBoard({ strokes, setStrokes, color, disabled }) {
  const svgRef = useRef(null)

  function point(event) {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    }
  }

  function start(event) {
    if (disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)

    setStrokes(old => [
      ...old,
      { color, size: 3, points: [point(event)] }
    ])
  }

  function move(event) {
    if (disabled || !event.buttons) return
    event.preventDefault()

    const nextPoint = point(event)

    setStrokes(old => {
      if (!old.length) return old
      const updated = [...old]
      const last = updated[updated.length - 1]

      updated[updated.length - 1] = {
        ...last,
        points: [...last.points, nextPoint]
      }

      return updated
    })
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      onPointerDown={start}
      onPointerMove={move}
      style={{
        width: '100%',
        aspectRatio: '5 / 3',
        background: 'white',
        border: '2px solid #333',
        borderRadius: 12,
        touchAction: 'none'
      }}
    >
      {strokes.map((stroke, index) => (
        <polyline
          key={index}
          points={stroke.points
            .map(p => `${p.x * 1000},${p.y * 600}`)
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
            .map(p => `${p.x * 1000},${p.y * 600}`)
            .join(' ')}
          fill="none"
          stroke={stroke.color || '#111'}
          strokeWidth={(stroke.size || 3) * 5}
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
  const [turnNumber, setTurnNumber] = useState(0)
  const [phaseEndsAt, setPhaseEndsAt] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  const [promptInput, setPromptInput] = useState('')
  const [prompt, setPrompt] = useState('')
  const [taskDrawing, setTaskDrawing] = useState(null)
  const [chainSteps, setChainSteps] = useState([])
  const [gallery, setGallery] = useState([])

  const [strokes, setStrokes] = useState([])
  const [color, setColor] = useState('#111111')
  const [guess, setGuess] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [promptSubmitted, setPromptSubmitted] = useState(false)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isHost = room?.host_player_id === playerId

  async function createRoom() {
    if (!nickname.trim()) {
      setMessage('Enter a nickname first!')
      return
    }

    setLoading(true)

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
    setMessage('Room created! Share your code.')
  }

  async function joinRoom() {
    if (!nickname.trim() || !roomCode.trim()) {
      setMessage('Enter your nickname and room code!')
      return
    }

    setLoading(true)

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
      setRoom(old => ({
        ...old,
        ...roomData,
        id: room.id,
        code: old.code
      }))
    }
  }

  async function refreshGame() {
    if (!room?.id || !playerId) return

    const { data, error } = await supabase.rpc('get_game_state', {
      p_room_id: room.id,
      p_player_id: playerId
    })

    if (error || !data) return

    if (data.phase) setPhase(data.phase)
    if (data.turn_number !== undefined) {
      setTurnNumber(data.turn_number)
    }

    setPhaseEndsAt(data.phase_ends_at || null)
    setPrompt(data.prompt || '')
    setTaskDrawing(data.task_drawing || null)
    setChainSteps(data.chain_steps || [])
    setGallery(data.gallery || [])

    setSubmitted(Boolean(data.submitted))
    setPromptSubmitted(Boolean(data.prompt_submitted))

    if (data.room_status) {
      setStatus(data.room_status)
    }
  }

  async function startGame() {
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

    setPromptInput('')
    setStrokes([])
    setGuess('')
    await refreshGame()
  }

  async function submitPrompt() {
    if (!promptInput.trim()) {
      setMessage('Write a prompt first!')
      return
    }

    setLoading(true)

    const { error } = await supabase.rpc('submit_prompt', {
      p_room_id: room.id,
      p_player_id: playerId,
      p_prompt: promptInput.trim()
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setPromptSubmitted(true)
    setMessage('Prompt submitted! Waiting for everyone else...')
    await refreshGame()
  }

  async function submitTurn() {
    if (submitted || secondsLeft <= 0) return

    if (phase === 'guessing' && !guess.trim()) {
      setMessage('Type your guess first!')
      return
    }

    setLoading(true)

    const { error } = await supabase.rpc('submit_turn', {
      p_room_id: room.id,
      p_player_id: playerId,
      p_text: phase === 'guessing' ? guess.trim() : null,
      p_drawing: phase === 'drawing' ? strokes : null
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setSubmitted(true)
    setMessage('Submitted! Waiting for the other players...')
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
    setMessage('')
    setStrokes([])
  }

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

  useEffect(() => {
    function updateTimer() {
      if (!phaseEndsAt) {
        setSecondsLeft(0)
        return
      }

      setSecondsLeft(Math.max(
        0,
        Math.ceil((new Date(phaseEndsAt).getTime() - Date.now()) / 1000)
      ))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [phaseEndsAt])

  const card = {
    background: 'white',
    color: '#292039',
    padding: 20,
    borderRadius: 16,
    maxWidth: 650,
    margin: '18px auto',
    boxShadow: '0 4px 18px #0001'
  }

  function renderGallery() {
    return (
      <div>
        <h2>🎉 THE CHAOS REVEAL!</h2>
        <p>See how everyone's original prompts changed!</p>

        {gallery.map((chain, index) => (
          <article
            key={index}
            style={{
              background: '#f4effb',
              padding: 16,
              borderRadius: 14,
              margin: '20px 0'
            }}
          >
            <h3>Chain {index + 1}</h3>

            <h4>Original prompt</h4>
            <p>{chain.original_prompt}</p>

            {(chain.steps || []).map((step, stepIndex) => (
              <div
                key={stepIndex}
                style={{
                  background: 'white',
                  padding: 12,
                  borderRadius: 10,
                  margin: '12px 0'
                }}
              >
                <strong>
                  {step.type === 'drawing' ? '🎨 Drawing' : '💭 Guess'}
                </strong>
                <p>By {step.nickname}</p>

                {step.type === 'drawing' ? (
                  <DrawingPreview strokes={step.drawing || []} />
                ) : (
                  <h3>{step.text}</h3>
                )}
              </div>
            ))}
          </article>
        ))}
      </div>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#f3edff',
      color: '#292039',
      padding: 18,
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>✳ DOODLE CHAOS</h1>
      <p>DRAW · GUESS · PASS · REVEAL</p>

      {!room && (
        <section style={card}>
          <h2>Ready for chaos?</h2>

          <input
            placeholder="Your nickname"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={18}
            style={{ padding: 12, width: '85%', margin: 8 }}
          />

          <div>
            <button style={button} onClick={createRoom} disabled={loading}>
              CREATE ROOM
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <input
              placeholder="ROOM CODE"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={5}
              style={{ padding: 12, width: 130 }}
            />
            <button style={button} onClick={joinRoom} disabled={loading}>
              JOIN ROOM
            </button>
          </div>

          {message && <p>{message}</p>}
        </section>
      )}

      {room && (
        <section style={card}>
          <h2>ROOM: {room.code}</h2>
          <p>Players: {players.length}</p>

          {status === 'waiting' && (
            <>
              <h3>Players in the room</h3>

              {players.map(player => (
                <p key={player.id}>🎨 {player.nickname}</p>
              ))}

              {isHost ? (
                <button style={button} onClick={startGame} disabled={loading}>
                  START GAME
                </button>
              ) : (
                <p>Waiting for the host...</p>
              )}
            </>
          )}

          {status === 'playing' && (
            <>
              <div style={{
                fontSize: 42,
                fontWeight: 'bold',
                color: secondsLeft <= 10 ? '#d32f2f' : '#683db3',
                margin: 12
              }}>
                {secondsLeft}s
              </div>

              <p>Round stage {turnNumber}</p>

              {phase === 'prompt' && (
                <>
                  <h2>✍️ WRITE YOUR PROMPT</h2>
                  <p>Think of something funny for someone to draw!</p>

                  {!promptSubmitted ? (
                    <>
                      <textarea
                        placeholder="Write your own silly prompt..."
                        value={promptInput}
                        onChange={e => setPromptInput(e.target.value)}
                        maxLength={120}
                        rows={4}
                        style={{
                          width: '95%',
                          padding: 12,
                          borderRadius: 10,
                          fontSize: 16
                        }}
                      />

                      <p>{promptInput.length}/120 characters</p>

                      <button
                        style={button}
                        onClick={submitPrompt}
                        disabled={loading || secondsLeft <= 0}
                      >
                        SUBMIT PROMPT
                      </button>
                    </>
                  ) : (
                    <h3>✅ Prompt submitted! Waiting for everyone...</h3>
                  )}

                  <p>Your prompt stays secret until the final reveal.</p>
                </>
              )}

              {phase === 'drawing' && (
                <>
                  <h2>🎨 DRAW THIS!</h2>

                  <div style={{
                    background: '#f2eaff',
                    padding: 14,
                    borderRadius: 12,
                    margin: '12px 0'
                  }}>
                    <h2>{prompt || 'Look at the previous guess!'}</h2>
                  </div>

                  {!submitted ? (
                    <>
                      <DrawingBoard
                        strokes={strokes}
                        setStrokes={setStrokes}
                        color={color}
                        disabled={secondsLeft <= 0}
                      />

                      <div style={{ margin: 12 }}>
                        {[
                          '#111111',
                          '#e53935',
                          '#1976d2',
                          '#2e9d50',
                          '#f5a623',
                          '#9c27b0'
                        ].map(c => (
                          <button
                            key={c}
                            onClick={() => setColor(c)}
                            aria-label={`Choose ${c}`}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: c,
                              border: color === c
                                ? '4px solid #888'
                                : '2px solid white',
                              margin: 4
                            }}
                          />
                        ))}
                      </div>

                      <button
                        style={button}
                        onClick={() => setColor('white')}
                      >
                        ERASER
                      </button>

                      <button
                        style={button}
                        onClick={() => setStrokes([])}
                      >
                        CLEAR
                      </button>

                      <div>
                        <button
                          style={button}
                          onClick={submitTurn}
                          disabled={loading || secondsLeft <= 0}
                        >
                          SUBMIT DRAWING
                        </button>
                      </div>
                    </>
                  ) : (
                    <h3>✅ Drawing submitted! Waiting for everyone...</h3>
                  )}
                </>
              )}

              {phase === 'guessing' && (
                <>
                  <h2>💭 WHAT IS THIS?</h2>
                  <p>Look carefully at the drawing and guess what it means!</p>

                  {taskDrawing && (
                    <DrawingPreview strokes={taskDrawing} />
                  )}

                  {!submitted ? (
                    <>
                      <textarea
                        placeholder="What do you think it is?"
                        value={guess}
                        onChange={e => setGuess(e.target.value)}
                        maxLength={120}
                        rows={3}
                        style={{
                          width: '95%',
                          padding: 12,
                          borderRadius: 10,
                          fontSize: 16,
                          marginTop: 12
                        }}
                      />

                      <button
                        style={button}
                        onClick={submitTurn}
                        disabled={loading || secondsLeft <= 0}
                      >
                        SUBMIT GUESS
                      </button>
                    </>
                  ) : (
                    <h3>✅ Guess submitted! Waiting for everyone...</h3>
                  )}
                </>
              )}

              {message && <p>{message}</p>}
            </>
          )}

          {status === 'finished' && renderGallery()}

          <button
            style={{ ...button, background: '#777', marginTop: 25 }}
            onClick={leaveRoom}
          >
            LEAVE ROOM
          </button>
        </section>
      )}

      <footer style={{ margin: 25 }}>
        MADE FOR FRIENDS, NOT ARTISTS.
      </footer>
    </main>
  )
}
