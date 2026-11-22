import { useState } from 'react'
import './style.css'

export default function App() {
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')

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

        <button onClick={() => alert('Room creation coming next!')}>
          + CREATE A ROOM
        </button>

        <div className="join">
          <input
            placeholder="ROOM CODE"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            maxLength={5}
          />

          <button onClick={() => alert('Joining rooms coming next!')}>
            JOIN ↗
          </button>
        </div>

        <small>No accounts needed. Just pick a nickname.</small>
      </section>

      <footer>
        MADE FOR FRIENDS, NOT ARTISTS.
      </footer>
    </main>
  )
}
