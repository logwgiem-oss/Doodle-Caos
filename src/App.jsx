import { useEffect, useState } from 'react'
import { supabase } from './subabase'

export default function App() {
  const [nickname, setNickname] = useState('')
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [roomId, setRoomId] = useState(localStorage.getItem('room_id') || '')
  const [playerId, setPlayerId] = useState(localStorage.getItem('player_id') || '')
  const [isHost, setIsHost] = useState(localStorage.getItem('is_host') === 'true')
  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState([])
  const [status, setStatus] = useState('waiting')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function createRoom() {
    if (!nickname.trim()) {
      setMessage('Please enter a nickname first.')
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
      setMessage('Room created, but the returned room details were incomplete.')
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
      setMessage('Could not find the room details returned by Supabase.')
      return
    }

    saveRoom(result, false)
  }

  function saveRoom(result, host) {
    const newRoomId = result.room_id
    const newPlayerId = result.player_id

    localStorage.setItem('room_id', newRoomId)
    localStorage.setItem('player_id', newPlayerId)
    localStorage.setItem('is_host', String(host))

    setRoomId(newRoomId)
    setPlayerId(newPlayerId)
    setIsHost(host)
    setRoomCode(result.code || '')
    setStatus('waiting')
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

    setRoomCode(
      room?.code ||
      room?.room_code ||
      result?.code ||
      roomCode
    )

    setPlayers(result?.players || room?.players || [])
    setStatus(room?.status || result?.status || 'waiting')
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

    await refreshRoom()
  }

  function leaveRoom() {
    localStorage.removeItem('room_id')
    localStorage.removeItem('player_id')
    localStorage.removeItem('is_host')

    setRoomId('')
    setPlayerId('')
    setRoomCode('')
    setPlayers([])
    setStatus('waiting')
    setMessage('')
  }

  useEffect(() => {
    if (!roomId || !playerId) return

    refreshRoom()

    const timer = setInterval(refreshRoom, 3000)
    return () => clearInterval(timer)
  }, [roomId, playerId])

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#17152b',
      color: 'white',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    },
    card: {
      background: '#262343',
      padding: '28px',
      borderRadius: '18px',
      width: '100%',
      maxWidth: '420px',
      boxSizing: 'border-box',
      textAlign: 'center'
    },
    input: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '13px',
      margin: '8px 0',
      borderRadius: '9px',
      border: '1px solid #625c87',
      background: '#17152b',
      color: 'white',
      fontSize: '16px'
    },
    button: {
      width: '100%',
      padding: '13px',
      marginTop: '10px',
      border: 'none',
      borderRadius: '9px',
      background: '#8067ff',
      color: 'white',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>🎨 Doodle Chaos</h1>
        <p>A drawing game full of surprises!</p>

        {!roomId ? (
          <>
            <input
              style={styles.input}
              placeholder="Your nickname"
              value={nickname}
              maxLength={18}
              onChange={(event) => setNickname(event.target.value)}
            />

            <button
              style={styles.button}
              onClick={createRoom}
              disabled={loading}
            >
              {loading ? 'Please wait...' : 'Create Room'}
            </button>

            <p>OR</p>

            <input
              style={styles.input}
              placeholder="Enter room code"
              value={roomCodeInput}
              onChange={(event) => setRoomCodeInput(event.target.value)}
            />

            <button
              style={styles.button}
              onClick={joinRoom}
              disabled={loading}
            >
              Join Room
            </button>
          </>
        ) : (
          <>
            <h2>Room: {roomCode || 'Loading...'}</h2>
            <p>Share this code with your friends!</p>

            <h3>Players in the room ({players.length})</h3>

            {players.length === 0 ? (
              <p>Loading players...</p>
            ) : (
              players.map((player, index) => (
                <p key={player.id || index}>
                  {player.nickname || player.name || 'Player'}
                  {player.id === playerId ? ' (You)' : ''}
                </p>
              ))
            )}

            {status === 'playing' ? (
              <h2>🎉 The game has started!</h2>
            ) : isHost ? (
              <button
                style={styles.button}
                onClick={startGame}
                disabled={loading}
              >
                {loading ? 'Starting...' : 'Start Game'}
              </button>
            ) : (
              <p>Waiting for the host to start the game...</p>
            )}

            <button
              style={{ ...styles.button, background: '#514c70' }}
              onClick={refreshRoom}
            >
              Refresh Lobby
            </button>

            <button
              style={{ ...styles.button, background: '#514c70' }}
              onClick={leaveRoom}
            >
              Leave Room
            </button>
          </>
        )}

        {message && (
          <p style={{ color: '#ffaaaa', marginTop: '15px' }}>
            {message}
          </p>
        )}
      </section>
    </main>
  )
}
