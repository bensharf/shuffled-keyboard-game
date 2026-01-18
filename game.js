// Game logic for the shuffled keyboard typing game - up to 3 players with ready system

const Game = {
  // Standard QWERTY layout
  QWERTY_ROWS: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ],

  // Game state
  state: {
    phase: 'lobby', // lobby, ready-lobby, countdown, playing, waiting, results
    seed: null,
    roundNumber: 0,
    currentWord: '',
    typedChars: '',
    startTime: null,
    players: [], // {id, name, ready, score, time, progress}
    myId: null,
    shuffledLayout: null,
    keyMapping: null
  },

  // Initialize the game
  init() {
    this.setupPhysicalKeyboard();
    this.renderLobby();
  },

  // Fisher-Yates shuffle with seeded random
  shuffleArray(array, rng) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  // Generate shuffled keyboard layout from seed
  generateShuffledLayout(seed) {
    const rng = seededRandom(seed);
    const allKeys = this.QWERTY_ROWS.flat();
    const shuffledKeys = this.shuffleArray(allKeys, rng);

    let index = 0;
    const shuffledRows = this.QWERTY_ROWS.map(row => {
      const newRow = shuffledKeys.slice(index, index + row.length);
      index += row.length;
      return newRow;
    });

    const keyMapping = {};
    const qwertyFlat = this.QWERTY_ROWS.flat();
    for (let i = 0; i < qwertyFlat.length; i++) {
      keyMapping[qwertyFlat[i]] = shuffledKeys[i];
    }

    this.state.shuffledLayout = shuffledRows;
    this.state.keyMapping = keyMapping;

    return shuffledRows;
  },

  // Render the on-screen keyboard
  renderKeyboard() {
    const container = document.getElementById('keyboard');
    if (!container) return;

    container.innerHTML = '';

    this.state.shuffledLayout.forEach((row) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'keyboard-row';

      row.forEach(key => {
        const keyBtn = document.createElement('button');
        keyBtn.className = 'key';
        keyBtn.textContent = key;
        keyBtn.dataset.key = key;
        keyBtn.addEventListener('click', () => this.handleKeyPress(key));
        keyBtn.addEventListener('touchstart', (e) => {
          e.preventDefault();
          this.handleKeyPress(key);
        });
        rowDiv.appendChild(keyBtn);
      });

      container.appendChild(rowDiv);
    });

    // Add backspace button
    const backspaceRow = document.createElement('div');
    backspaceRow.className = 'keyboard-row';
    const backspaceBtn = document.createElement('button');
    backspaceBtn.className = 'key key-backspace';
    backspaceBtn.textContent = '⌫';
    backspaceBtn.addEventListener('click', () => this.handleBackspace());
    backspaceBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleBackspace();
    });
    backspaceRow.appendChild(backspaceBtn);
    container.appendChild(backspaceRow);
  },

  // Setup physical keyboard input
  setupPhysicalKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (this.state.phase !== 'playing') return;

      const key = e.key.toUpperCase();

      if (e.key === 'Backspace') {
        e.preventDefault();
        this.handleBackspace();
        return;
      }

      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        e.preventDefault();
        const mappedKey = this.state.keyMapping[key];
        if (mappedKey) {
          this.handleKeyPress(mappedKey);
        }
      }
    });
  },

  // Handle key press
  handleKeyPress(key) {
    if (this.state.phase !== 'playing') return;

    const nextExpectedChar = this.state.currentWord[this.state.typedChars.length];

    if (key === nextExpectedChar) {
      this.state.typedChars += key;
      this.updateWordDisplay();
      this.highlightKey(key, 'correct');

      PeerConnection.sendProgress(this.state.typedChars.length);

      if (this.state.typedChars === this.state.currentWord) {
        this.completeWord();
      }
    } else {
      this.highlightKey(key, 'incorrect');
    }
  },

  // Handle backspace
  handleBackspace() {
    if (this.state.phase !== 'playing') return;
    if (this.state.typedChars.length > 0) {
      this.state.typedChars = this.state.typedChars.slice(0, -1);
      this.updateWordDisplay();
      PeerConnection.sendProgress(this.state.typedChars.length);
    }
  },

  // Highlight a key temporarily
  highlightKey(key, type) {
    const keyBtn = document.querySelector(`.key[data-key="${key}"]`);
    if (keyBtn) {
      keyBtn.classList.add(type);
      setTimeout(() => keyBtn.classList.remove(type), 150);
    }
  },

  // Update the word display with typed progress
  updateWordDisplay() {
    const display = document.getElementById('word-display');
    if (!display) return;

    let html = '';
    for (let i = 0; i < this.state.currentWord.length; i++) {
      const char = this.state.currentWord[i];
      if (i < this.state.typedChars.length) {
        html += `<span class="char typed">${char}</span>`;
      } else if (i === this.state.typedChars.length) {
        html += `<span class="char current">${char}</span>`;
      } else {
        html += `<span class="char">${char}</span>`;
      }
    }
    display.innerHTML = html;
  },

  // Update player progress display
  updatePlayerProgress(playerId, progress) {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.progress = progress;
    }
    this.updateStatusDisplay();
  },

  // Update all player status displays
  updateStatusDisplay() {
    this.state.players.forEach(player => {
      const display = document.getElementById(`player-status-${player.id}`);
      if (display && this.state.phase === 'playing') {
        if (player.time !== null) {
          display.textContent = `${player.name}: ${player.time.toFixed(2)}s ✓`;
        } else {
          const progress = player.progress || 0;
          const progressBar = '█'.repeat(progress) + '░'.repeat(this.state.currentWord.length - progress);
          display.textContent = `${player.name}: [${progressBar}]`;
        }
      }
    });
  },

  // Complete word - player finished typing
  completeWord() {
    const endTime = Date.now();
    const myTime = (endTime - this.state.startTime) / 1000;

    const me = this.state.players.find(p => p.id === this.state.myId);
    if (me) {
      me.time = myTime;
      me.progress = this.state.currentWord.length;
    }

    this.state.phase = 'waiting';
    PeerConnection.sendComplete(myTime);

    this.updateStatusDisplay();
    this.checkRoundEnd();
  },

  // Player completed the word
  playerComplete(playerId, time) {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.time = time;
      player.progress = this.state.currentWord.length;
    }
    this.updateStatusDisplay();
    this.checkRoundEnd();
  },

  // Check if round should end
  checkRoundEnd() {
    const allDone = this.state.players.every(p => p.time !== null);
    if (allDone) {
      setTimeout(() => this.endRound(), 500);
    }
  },

  // End the round and show results
  endRound() {
    this.state.phase = 'results';

    // Sort players by time
    const sortedPlayers = [...this.state.players].sort((a, b) => a.time - b.time);
    const winner = sortedPlayers[0];

    // Award point to winner
    const winnerPlayer = this.state.players.find(p => p.id === winner.id);
    if (winnerPlayer) {
      winnerPlayer.score = (winnerPlayer.score || 0) + 1;
    }

    const me = this.state.players.find(p => p.id === this.state.myId);
    const iWon = winner.id === this.state.myId;

    let resultText;
    let resultClass;
    if (iWon) {
      resultText = 'YOU WIN!';
      resultClass = 'win';
    } else {
      resultText = `${winner.name} WINS!`;
      resultClass = 'lose';
    }

    // Check if game is over (first to 5)
    const gameWinner = this.state.players.find(p => (p.score || 0) >= 5);
    if (gameWinner) {
      this.showGameOver(gameWinner);
    } else {
      this.showResults(resultText, resultClass, sortedPlayers);
    }
  },

  // Show game over screen
  showGameOver(winner) {
    const iWon = winner.id === this.state.myId;
    const sortedPlayers = [...this.state.players].sort((a, b) => (b.score || 0) - (a.score || 0));

    let scoresHtml = sortedPlayers.map(p => {
      const isWinner = p.id === winner.id;
      return `<div class="final-score-row ${isWinner ? 'winner' : ''}">${p.name}: ${p.score || 0}</div>`;
    }).join('');

    document.getElementById('game-area').innerHTML = `
      <div class="results game-over">
        <h2 class="${iWon ? 'win' : 'lose'}">${iWon ? 'VICTORY!' : winner.name + ' WINS!'}</h2>
        <div class="final-score">
          <p>Final Score</p>
          <div class="final-scores-list">
            ${scoresHtml}
          </div>
        </div>
        <p class="game-over-message">${iWon ? 'Go Bills!' : 'Better luck next time!'}</p>
        <button id="play-again-btn" class="btn btn-primary">Play Again</button>
      </div>
    `;

    document.getElementById('play-again-btn').addEventListener('click', () => {
      location.reload();
    });
  },

  // Show results screen
  showResults(resultText, resultClass, sortedPlayers) {
    let timesHtml = sortedPlayers.map((p, index) => {
      const isWinner = index === 0;
      return `
        <div class="time-row ${isWinner ? 'winner' : ''}">
          <span>${p.name}:</span>
          <span>${p.time.toFixed(2)}s</span>
        </div>
      `;
    }).join('');

    let scoresHtml = this.state.players.map(p => `${p.name}: ${p.score || 0}`).join(' | ');

    document.getElementById('game-area').innerHTML = `
      <div class="results">
        <h2 class="${resultClass}">${resultText}</h2>
        <div class="word-reveal">
          <p>The word was:</p>
          <div class="revealed-word">${this.state.currentWord}</div>
        </div>
        <div class="times">
          ${timesHtml}
        </div>
        <div class="score">
          ${scoresHtml}
        </div>
        <button id="next-round-btn" class="btn btn-primary">Next Round</button>
      </div>
    `;

    document.getElementById('next-round-btn').addEventListener('click', () => {
      if (PeerConnection.isHost) {
        this.startNewRound();
      } else {
        document.getElementById('next-round-btn').textContent = 'Waiting for host...';
        document.getElementById('next-round-btn').disabled = true;
      }
    });
  },

  // Start a new round (host only)
  startNewRound() {
    this.state.roundNumber++;
    const word = getWordFromSeed(this.state.seed, this.state.roundNumber);

    PeerConnection.sendStartRound({
      roundNumber: this.state.roundNumber,
      word: word
    });

    this.beginRound(word);
  },

  // Begin a round (all players)
  beginRound(word, roundNumber) {
    if (roundNumber !== undefined) {
      this.state.roundNumber = roundNumber;
    }
    this.state.currentWord = word;
    this.state.typedChars = '';

    // Reset time and progress for all players
    this.state.players.forEach(p => {
      p.time = null;
      p.progress = 0;
    });

    this.renderCountdownScreen();
  },

  // Render countdown screen (word and keyboard hidden)
  renderCountdownScreen() {
    let scoresHtml = this.state.players.map(p => `${p.name}: ${p.score || 0}`).join(' | ');

    document.getElementById('game-area').innerHTML = `
      <div class="game-screen">
        <div class="score-display">${scoresHtml}</div>
        <div class="round-display">Round ${this.state.roundNumber}</div>
        <div class="get-ready">GET READY!</div>
        <div id="countdown" class="countdown">3</div>
      </div>
    `;

    this.startCountdown();
  },

  // Start countdown before round
  startCountdown() {
    this.state.phase = 'countdown';
    const countdownEl = document.getElementById('countdown');
    let count = 3;

    countdownEl.classList.add('active');

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.textContent = count;
      } else if (count === 0) {
        countdownEl.textContent = 'GO!';
      } else {
        clearInterval(interval);
        this.showWordAndStart();
      }
    }, 1000);
  },

  // Show the word and start playing
  showWordAndStart() {
    let statusHtml = this.state.players.map(p =>
      `<p id="player-status-${p.id}">${p.name}: typing...</p>`
    ).join('');

    document.getElementById('game-area').innerHTML = `
      <div class="game-screen">
        <div class="round-display">Round ${this.state.roundNumber}</div>
        <div class="word-container">
          <div id="word-display" class="word-display"></div>
        </div>
        <div class="status-container">
          ${statusHtml}
        </div>
        <div id="keyboard" class="keyboard"></div>
      </div>
    `;

    this.renderKeyboard();
    this.updateWordDisplay();
    this.startPlaying();
  },

  // Start the playing phase
  startPlaying() {
    this.state.phase = 'playing';
    this.state.startTime = Date.now();
  },

  // Buffalo Bills charging buffalo logo SVG
  getBillsLogo() {
    return `<svg class="bills-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <!-- Charging Buffalo silhouette -->
      <ellipse cx="50" cy="75" rx="35" ry="8" fill="rgba(0,0,0,0.2)"/>
      <g fill="#C60C30" stroke="#ffffff" stroke-width="2">
        <!-- Body -->
        <ellipse cx="45" cy="50" rx="30" ry="20"/>
        <!-- Head -->
        <circle cx="78" cy="45" r="14"/>
        <!-- Front legs -->
        <path d="M30 65 L25 85 L30 85 L35 65"/>
        <path d="M45 65 L42 85 L47 85 L50 65"/>
        <!-- Back legs -->
        <path d="M55 65 L58 85 L63 85 L60 65"/>
        <!-- Horns -->
        <path d="M72 32 Q65 20 55 22" stroke-width="4" fill="none"/>
        <path d="M84 32 Q91 20 100 22" stroke-width="4" fill="none"/>
        <!-- Tail -->
        <path d="M15 45 Q5 40 8 50" stroke-width="3" fill="none"/>
        <!-- Eye -->
        <circle cx="82" cy="43" r="2" fill="#ffffff" stroke="none"/>
      </g>
    </svg>`;
  },

  // Render lobby screen
  renderLobby() {
    document.getElementById('game-area').innerHTML = `
      <div class="lobby">
        ${this.getBillsLogo()}
        <h1>Scotty's Keyboard Shuffle</h1>
        <p class="subtitle">Race to type words on a shuffled keyboard. First to 5 wins!</p>

        <div class="username-section">
          <input type="text" id="username-input" placeholder="Enter your name" maxlength="12">
        </div>

        <div class="lobby-buttons">
          <button id="create-room-btn" class="btn btn-primary">Create Room</button>
          <div class="divider">or</div>
          <div class="join-section">
            <input type="text" id="room-code-input" placeholder="Enter room code" maxlength="8">
            <button id="join-room-btn" class="btn btn-secondary">Join Room</button>
          </div>
        </div>

        <div id="room-status" class="room-status"></div>
      </div>
    `;

    document.getElementById('create-room-btn').addEventListener('click', () => {
      const username = document.getElementById('username-input').value.trim() || 'Player 1';
      PeerConnection.createRoom(username);
    });

    document.getElementById('join-room-btn').addEventListener('click', () => {
      const code = document.getElementById('room-code-input').value.trim().toUpperCase();
      const username = document.getElementById('username-input').value.trim() || 'Player';
      if (code) {
        PeerConnection.joinRoom(code, username);
      }
    });

    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const code = e.target.value.trim().toUpperCase();
        const username = document.getElementById('username-input').value.trim() || 'Player';
        if (code) {
          PeerConnection.joinRoom(code, username);
        }
      }
    });
  },

  // Show lobby with player list and ready buttons
  showReadyLobby(players, myId) {
    this.state.phase = 'ready-lobby';
    this.state.players = players.map(p => ({
      ...p,
      score: 0,
      time: null,
      progress: 0
    }));
    this.state.myId = myId;

    const me = players.find(p => p.id === myId);
    const isReady = me ? me.ready : false;
    const allReady = players.length >= 2 && players.every(p => p.ready);

    let playersHtml = players.map(p => {
      const isMe = p.id === myId;
      const readyClass = p.ready ? 'ready' : '';
      const hostBadge = (p.id === players[0].id) ? ' <span class="host-badge">HOST</span>' : '';
      return `
        <div class="player-card ${isMe ? 'is-me' : ''} ${readyClass}">
          <div class="player-name">${p.name}${isMe ? ' (You)' : ''}${hostBadge}</div>
          <div class="player-ready-status">${p.ready ? 'READY' : 'Not Ready'}</div>
        </div>
      `;
    }).join('');

    const waitingMessage = players.length < 2
      ? 'Waiting for players to join...'
      : (allReady ? 'Starting game...' : 'Waiting for all players to ready up...');

    document.getElementById('game-area').innerHTML = `
      <div class="ready-lobby">
        ${this.getBillsLogo()}
        <h1>Scotty's Keyboard Shuffle</h1>
        <div class="room-code-header">
          <span>Room Code:</span>
          <span class="room-code-value">${PeerConnection.roomCode}</span>
          <button class="btn-copy-small" id="copy-code-btn">Copy</button>
        </div>
        <div class="players-list">
          ${playersHtml}
        </div>
        <p class="waiting-message">${waitingMessage}</p>
        <button id="ready-btn" class="btn ${isReady ? 'btn-ready' : 'btn-primary'}">
          ${isReady ? 'READY!' : 'Ready Up'}
        </button>
        <p class="player-count">${players.length}/3 Players</p>
      </div>
    `;

    document.getElementById('ready-btn').addEventListener('click', () => {
      PeerConnection.toggleReady();
    });

    document.getElementById('copy-code-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(PeerConnection.roomCode).then(() => {
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 2000);
      });
    });
  },

  // Show connecting status
  showConnecting() {
    document.getElementById('room-status').innerHTML = `
      <p class="connecting">Connecting...</p>
    `;
  },

  // Show error message
  showError(message) {
    document.getElementById('room-status').innerHTML = `
      <p class="error">${message}</p>
    `;
  },

  // Start game when all players ready
  startGame(seed, players, myId) {
    this.state.seed = seed;
    this.state.roundNumber = 0;
    this.state.myId = myId;
    this.state.players = players.map(p => ({
      ...p,
      score: 0,
      time: null,
      progress: 0
    }));

    // Generate the shuffled layout
    this.generateShuffledLayout(seed);

    if (PeerConnection.isHost) {
      this.startNewRound();
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});
