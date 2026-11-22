import { useEffect, useRef, useState } from "react";
import { supabase } from "./subabase";

const PREVIEW_SECONDS = 3;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#151525",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: "20px",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "650px",
    margin: "0 auto",
  },
  card: {
    background: "#24243b",
    borderRadius: "18px",
    padding: "22px",
    marginBottom: "18px",
  },
  input: {
    width: "100%",
    padding: "14px",
    boxSizing: "border-box",
    borderRadius: "10px",
    border: "1px solid #555",
    background: "#17172a",
    color: "white",
    fontSize: "16px",
    marginBottom: "12px",
  },
  button: {
    width: "100%",
    padding: "14px",
    borderRadius: "10px",
    border: "none",
    background: "#8065ff",
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "8px",
  },
};

function DrawingBoard({ onSubmit, disabled }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);

  const [color, setColor] = useState("#111111");
  const [brushSize, setBrushSize] = useState(5);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const oldStrokes = strokesRef.current;

      canvas.width = Math.max(1, Math.round(rect.width * 2));
      canvas.height = Math.max(1, Math.round(rect.height * 2));

      redraw(oldStrokes);
    }

    resize();
    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, []);

  function redraw(strokes = strokesRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      if (!stroke.points?.length) return;

      const lineWidth = stroke.size * 2;

      // A single tap creates a filled dot.
      if (stroke.points.length === 1) {
        const point = stroke.points[0];

        ctx.beginPath();
        ctx.fillStyle = stroke.color;

        ctx.arc(
          point.x * canvas.width,
          point.y * canvas.height,
          lineWidth / 2,
          0,
          Math.PI * 2
        );

        ctx.fill();
        return;
      }

      // Draw normal lines.
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      stroke.points.forEach((point, index) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    });
  }

  function getPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function startDrawing(event) {
    if (disabled) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    drawingRef.current = true;

    currentStrokeRef.current = {
      color,
      size: brushSize,
      points: [getPoint(event)],
    };

    strokesRef.current = [
      ...strokesRef.current,
      currentStrokeRef.current,
    ];

    redraw();
  }

  function moveDrawing(event) {
    if (!drawingRef.current || disabled) return;

    event.preventDefault();

    currentStrokeRef.current.points.push(getPoint(event));
    redraw();
  }

  function stopDrawing() {
    drawingRef.current = false;
    currentStrokeRef.current = null;
  }

  function clearCanvas() {
    strokesRef.current = [];
    redraw();
  }

  function undo() {
    strokesRef.current.pop();
    redraw();
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerMove={moveDrawing}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onContextMenu={(event) => event.preventDefault()}
        style={{
          width: "100%",
          height: "350px",
          background: "white",
          borderRadius: "12px",
          touchAction: "none",
          display: "block",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "12px",
          alignItems: "center",
        }}
      >
        <label>
          Colour{" "}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={disabled}
          />
        </label>

        <label>
          Brush{" "}
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            disabled={disabled}
          />
        </label>

        <button onClick={undo} disabled={disabled}>
          Undo
        </button>

        <button onClick={clearCanvas} disabled={disabled}>
          Clear
        </button>
      </div>

      <button
        style={styles.button}
        disabled={disabled}
        onClick={() => onSubmit(strokesRef.current)}
      >
        Submit drawing
      </button>
    </div>
  );
}

function DrawingPreview({
  drawing,
  allowDownload = false,
  downloadName = "doodle-chaos-drawing",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    canvas.width = 600;
    canvas.height = 400;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!Array.isArray(drawing)) return;

    drawing.forEach((stroke) => {
      if (!stroke.points?.length) return;

      const lineWidth = (stroke.size || 5) * 2;

      // Keep single-tap dots visible in previews and downloads.
      if (stroke.points.length === 1) {
        const point = stroke.points[0];

        ctx.beginPath();
        ctx.fillStyle = stroke.color || "#111";

        ctx.arc(
          point.x * canvas.width,
          point.y * canvas.height,
          lineWidth / 2,
          0,
          Math.PI * 2
        );

        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.strokeStyle = stroke.color || "#111";
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      stroke.points.forEach((point, index) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    });
  }, [drawing]);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");

    link.href = canvas.toDataURL("image/png");
    link.download = `${downloadName}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "auto",
          background: "white",
          borderRadius: "10px",
          display: "block",
        }}
      />

      {allowDownload && (
        <button
          type="button"
          style={styles.button}
          onClick={downloadPng}
        >
          ⬇️ Download PNG
        </button>
      )}
    </div>
  );
}

function App() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);

  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  const [phase, setPhase] = useState("waiting");
  const [turnNumber, setTurnNumber] = useState(0);
  const [phaseEndsAt, setPhaseEndsAt] = useState(null);

  const [taskPrompt, setTaskPrompt] = useState("");
  const [taskDrawing, setTaskDrawing] = useState([]);

  const [promptInput, setPromptInput] = useState("");
  const [guessInput, setGuessInput] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const [promptSubmitted, setPromptSubmitted] = useState(false);

  const [gallery, setGallery] = useState([]);

  const [preview, setPreview] = useState(false);
  const [previewCountdown, setPreviewCountdown] =
    useState(PREVIEW_SECONDS);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const previewKeyRef = useRef("");

  async function createRoom() {
    if (!nickname.trim()) {
      setMessage("Enter your nickname first.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("create_room", {
      p_nickname: nickname.trim(),
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRoomId(data.room_id);
    setPlayerId(data.player_id);
    setRoomCode(data.code);

    await refreshRoom(data.room_id, data.player_id);
  }

  async function joinRoom() {
    if (!nickname.trim() || !roomCode.trim()) {
      setMessage("Enter your nickname and room code.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("join_room", {
      p_code: roomCode.trim().toUpperCase(),
      p_nickname: nickname.trim(),
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRoomId(data.room_id);
    setPlayerId(data.player_id);

    await refreshRoom(data.room_id, data.player_id);
  }

  async function refreshRoom(id = roomId, pid = playerId) {
    if (!id || !pid) return;

    const { data, error } = await supabase.rpc("get_room_state", {
      p_room_id: id,
      p_player_id: pid,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setRoom(data.room || data);
    setPlayers(data.players || []);
  }

  async function refreshGame() {
    if (!roomId || !playerId) return;

    const { data, error } = await supabase.rpc("get_game_state", {
      p_room_id: roomId,
      p_player_id: playerId,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) return;

    if (data.room_status === "waiting") {
      setPhase("waiting");
      return;
    }

    setPhase(data.phase || "waiting");
    setTurnNumber(data.turn_number || 0);
    setPhaseEndsAt(data.phase_ends_at || null);

    setTaskPrompt(data.prompt || "");
    setTaskDrawing(data.task_drawing || []);

    setSubmitted(Boolean(data.submitted));
    setPromptSubmitted(Boolean(data.prompt_submitted));

    setGallery(data.gallery || []);
  }

  async function startGame() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.rpc("start_game", {
      p_room_id: roomId,
      p_player_id: playerId,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    previewKeyRef.current = "";
    await refreshGame();
  }

  async function submitPrompt() {
    if (!promptInput.trim()) {
      setMessage("Write a prompt first.");
      return;
    }

    const { error } = await supabase.rpc("submit_prompt", {
      p_room_id: roomId,
      p_player_id: playerId,
      p_prompt: promptInput.trim(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setPromptSubmitted(true);
    setMessage("Prompt submitted!");
    await refreshGame();
  }

  async function submitTurn(text, drawing) {
    const { error } = await supabase.rpc("submit_turn", {
      p_room_id: roomId,
      p_player_id: playerId,
      p_text: text || null,
      p_drawing: drawing || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSubmitted(true);
    setMessage("Submitted! Waiting for everyone else...");
    await refreshGame();
  }

  async function leaveRoom() {
    if (roomId && playerId) {
      await supabase.rpc("leave_room", {
        p_room_id: roomId,
        p_player_id: playerId,
      });
    }

    setRoom(null);
    setPlayers([]);
    setRoomId(null);
    setPlayerId(null);
    setPhase("waiting");
    setMessage("");
  }

  // Poll the room and game state.
  useEffect(() => {
    if (!roomId || !playerId) return;

    refreshRoom();
    refreshGame();

    const interval = setInterval(() => {
      refreshRoom();
      refreshGame();
    }, 1500);

    return () => clearInterval(interval);
  }, [roomId, playerId]);

  // Show a three-second preview for each new drawing or guessing task.
  useEffect(() => {
    if (phase !== "drawing" && phase !== "guessing") {
      setPreview(false);
      return;
    }

    const key = `${turnNumber}-${phase}`;

    if (previewKeyRef.current === key) return;

    previewKeyRef.current = key;

    setPreview(true);
    setPreviewCountdown(PREVIEW_SECONDS);
    setGuessInput("");

    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, PREVIEW_SECONDS - elapsed);

      setPreviewCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setPreview(false);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase, turnNumber]);

  // Phase countdown.
  useEffect(() => {
    if (!phaseEndsAt) return;

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(phaseEndsAt).getTime() - Date.now()) / 1000
        )
      );

      setSecondsLeft(remaining);
    };

    update();

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }

  function renderPreview() {
    if (phase === "drawing") {
      return (
        <div style={styles.card}>
          <h2>Memorise this prompt!</h2>

          <div
            style={{
              background: "white",
              color: "#17172a",
              borderRadius: "12px",
              padding: "30px 15px",
              fontSize: "25px",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            {taskPrompt}
          </div>

          <h1 style={{ textAlign: "center" }}>
            {previewCountdown}
          </h1>
        </div>
      );
    }

    if (phase === "guessing") {
      return (
        <div style={styles.card}>
          <h2>Memorise this drawing!</h2>

          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "10px",
            }}
          >
            <DrawingPreview drawing={taskDrawing} />
          </div>

          <h1 style={{ textAlign: "center" }}>
            {previewCountdown}
          </h1>
        </div>
      );
    }

    return null;
  }

  if (!roomId) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1 style={{ textAlign: "center", fontSize: "42px" }}>
            🎨 Doodle Chaos
          </h1>

          <p style={{ textAlign: "center", color: "#aaa" }}>
            Draw it. Guess it. Watch it become chaos.
          </p>

          <div style={styles.card}>
            <h2>Enter the game</h2>

            <input
              style={styles.input}
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />

            <button
              style={styles.button}
              onClick={createRoom}
              disabled={loading}
            >
              Create room
            </button>

            <hr style={{ borderColor: "#444", margin: "22px 0" }} />

            <input
              style={styles.input}
              placeholder="Room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
            />

            <button
              style={styles.button}
              onClick={joinRoom}
              disabled={loading}
            >
              Join room
            </button>

            {message && <p>{message}</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={{ textAlign: "center" }}>
          🎨 Doodle Chaos
        </h1>

        <div style={styles.card}>
          <h2>Room: {roomCode}</h2>

          <p>Players: {players.length}</p>

          {players.map((player) => (
            <p key={player.id}>
              👤 {player.nickname}
              {player.id === playerId ? " (You)" : ""}
            </p>
          ))}

          <button
            style={{ ...styles.button, background: "#555" }}
            onClick={leaveRoom}
          >
            Leave room
          </button>
        </div>

        {message && (
          <p style={{ textAlign: "center" }}>{message}</p>
        )}

        {phase === "waiting" && (
          <div style={styles.card}>
            <h2>Waiting for the game</h2>

            <p>Invite your friends using the room code.</p>

            <button
              style={styles.button}
              onClick={startGame}
              disabled={loading}
            >
              🎮 Start Game
            </button>
          </div>
        )}

        {phase === "prompt" && (
          <div style={styles.card}>
            <h2>Write your secret prompt!</h2>

            <p>
              Everyone writes their own prompt.
              Other players won't see it until the final reveal.
            </p>

            <h2>{formatTime(secondsLeft)}</h2>

            {promptSubmitted ? (
              <h3>
                ✅ Your prompt is submitted. Waiting for everyone...
              </h3>
            ) : (
              <>
                <textarea
                  style={{
                    ...styles.input,
                    minHeight: "110px",
                    resize: "vertical",
                  }}
                  placeholder="Write something funny..."
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                />

                <button
                  style={styles.button}
                  onClick={submitPrompt}
                >
                  Submit prompt
                </button>
              </>
            )}
          </div>
        )}

        {(phase === "drawing" || phase === "guessing") && (
          <>
            <div style={styles.card}>
              <h2>
                {phase === "drawing"
                  ? "✏️ Drawing round"
                  : "💭 Guessing round"}
              </h2>

              <p>
                Stage {turnNumber} · Time left: {formatTime(secondsLeft)}
              </p>
            </div>

            {preview ? (
              renderPreview()
            ) : submitted ? (
              <div style={styles.card}>
                <h2>✅ Submitted!</h2>
                <p>Waiting for the other players...</p>
              </div>
            ) : phase === "drawing" ? (
              <div style={styles.card}>
                <h2>Draw what you remember!</h2>

                <p>The prompt is hidden now. Good luck!</p>

                <DrawingBoard
                  onSubmit={(drawing) => submitTurn(null, drawing)}
                  disabled={submitted}
                />
              </div>
            ) : (
              <div style={styles.card}>
                <h2>What do you think this drawing is?</h2>

                <p>The drawing has disappeared. Write your guess!</p>

                <textarea
                  style={{
                    ...styles.input,
                    minHeight: "110px",
                  }}
                  placeholder="I think this is..."
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                />

                <button
                  style={styles.button}
                  onClick={() => {
                    if (!guessInput.trim()) {
                      setMessage("Write a guess first.");
                      return;
                    }

                    submitTurn(guessInput.trim(), null);
                  }}
                >
                  Submit guess
                </button>
              </div>
            )}
          </>
        )}

        {phase === "finished" && (
          <div style={styles.card}>
            <h1>🎉 Final reveal!</h1>

            <p>Look how much the original ideas changed!</p>
            <p>Each drawing can be saved as a PNG image.</p>

            {gallery.length === 0 && (
              <p>The gallery is empty. Try refreshing the page.</p>
            )}

            {gallery.map((chain, index) => (
              <div
                key={chain.id || index}
                style={{
                  background: "#17172a",
                  padding: "16px",
                  borderRadius: "12px",
                  marginBottom: "18px",
                }}
              >
                <h3>Chain {index + 1}</h3>

                <p>
                  <strong>Original prompt:</strong>{" "}
                  {chain.original_prompt}
                </p>

                {(chain.steps || []).map((step, stepIndex) => {
                  const stage =
                    step.stage ?? step.stage_number ?? stepIndex + 1;

                  const type = step.type || step.action_type;
                  const textAnswer = step.text ?? step.text_answer;

                  return (
                    <div key={step.id || stepIndex}>
                      <hr style={{ borderColor: "#555" }} />

                      <p>
                        <strong>
                          Stage {stage} ·{" "}
                          {type === "drawing" ? "Drawing" : "Guess"}
                        </strong>

                        {step.nickname ? ` · ${step.nickname}` : ""}
                      </p>

                      {type === "drawing" ? (
                        <DrawingPreview
                          drawing={step.drawing}
                          allowDownload
                          downloadName={`doodle-chaos-chain-${index + 1}-stage-${stage}`}
                        />
                      ) : (
                        <p>
                          {textAnswer || "No guess was submitted."}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
