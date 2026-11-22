import { useState } from 'react'
import { supabase } from './subabase'
import './style.css'

export default function App() {
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [room, setRoom] = useState(null)

  async function createRoom() {
    if (!nickname.trim()) {
      setMessage('Please enter a nickname first!')
      return
    }

    setLoading(true)
    setMessage('')
    setRoom(null)

    const { data, error } = await supabase.rpc('create_room', {
      p_nickname: nickname.trim()
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setRoom(data)
    setMessage('Your room is ready! Share the code with your friends.')
  }

  async function joinRoom() {
    if (!nickname.trim()) {
      setMessage('Please enter a nickname first!')
      return
    }

    if (!roomCode.trim()) {
      setMessage('Please enter a room code!')
      return
    }

    setLoading(true)
    setMessage('')
    setRoom(null)

    const { data, error } = await supabase.rpc('join_room', {
      p_nickname: nickname.trim(),
      p_code: roomCode.trim()
    })

    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setRoom(data)
    setMessage('You joined the room successfully!')
  }

  return (
    <main className="app">
      <header>
        <h2>✳ DOODLE CHAOS</h2>
        <span>THE DRAWING PARTY GAME</span>
      </header>

      <section className="hero">
        <p>DRAW · PASS · LAUGH</p>
        <h1>Good ideas.<br /><em>Terrible</em> drawings.</h1>
        <p>
          Grab your friends, make some drawings
          and see how chaotic things get.
        </p>
      </section>

      <section className="lobby">
        <h2>Let's make a mess.</h2>

        <label>Your nickname</label>
        <input
          placeholder="Enter your nickname"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          maxLength={18}
        />

        <button onClick={createRoom} disabled={loading}>
          {loading ? 'PLEASE WAIT...' : '+ CREATE A ROOM'}
        </button>

        <div className="join">
          <input
            placeholder="ROOM CODE"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            maxLength={5}
          />

          <button onClick={joinRoom} disabled={loading}>
            JOIN ↗
          </button>
        </div>

        {message && <p role="status">{message}</p>}

        {room && (
          <div>
            <h3>ROOM CODE</h3>
            <h1>{room.code}</h1>
            <p>Share this code with your friends!</p>
          </div>
        )}

        <small>No accounts needed. Just pick a nickname.</small>
      </section>

      <footer>
        MADE FOR FRIENDS, NOT ARTISTS.
      </footer>
    </main>
  )
}
