// Game logic for the shuffled keyboard typing game - supports up to 3 players

const Game = {
  // Standard QWERTY layout
  QWERTY_ROWS: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ],

  // Game state
  state: {
    phase: 'lobby', // lobby, waiting, countdown, playing, results
    seed: null,
    roundNumber: 0,
    currentWord: '',
    typedChars: '',
    startTime: null,
    endTime: null,
    shuffledLayout: null,
    keyMapping: null,
    players: [], // {id, name, score, time, progress, finished}
    myPlayerId: null
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

    this.state.shuffledLayout.forEach((row, rowIndex) => {
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

  // Update a player's progress
  updatePlayerProgress(playerId, progress) {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.progress = progress;
      this.renderPlayersStatus();
    }
  },

  // Render all players' status during gameplay
  renderPlayersStatus() {
    const container = document.getElementById('players-status');
    if (!container) return;

    let html = '';
    this.state.players.forEach(player => {
      const isMe = player.id === this.state.myPlayerId;
      const statusClass = isMe ? 'player-status me' : 'player-status';

      let status;
      if (player.finished) {
        status = `${player.time.toFixed(2)}s`;
      } else {
        const progressBar = '█'.repeat(player.progress) + '░'.repeat(this.state.currentWord.length - player.progress);
        status = `[${progressBar}]`;
      }

      html += `
        <div class="${statusClass}">
          <span class="player-name">${player.name}${isMe ? ' (You)' : ''}</span>
          <span class="player-progress">${status}</span>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  // Complete word - player finished typing
  completeWord() {
    this.state.endTime = Date.now();
    const myTime = (this.state.endTime - this.state.startTime) / 1000;
    this.state.phase = 'waiting';

    // Update my player data
    const myPlayer = this.state.players.find(p => p.id === this.state.myPlayerId);
    if (myPlayer) {
      myPlayer.time = myTime;
      myPlayer.finished = true;
    }

    PeerConnection.sendComplete(myTime);
    this.renderPlayersStatus();
    this.checkRoundEnd();
  },

  // Another player completed the word
  playerComplete(playerId, time) {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.time = time;
      player.finished = true;
      player.progress = this.state.currentWord.length;
    }

    this.renderPlayersStatus();
    this.checkRoundEnd();
  },

  // Handle player disconnect during game
  handlePlayerDisconnect(playerId) {
    this.state.players = this.state.players.filter(p => p.id !== playerId);
    this.renderPlayersStatus();
    this.checkRoundEnd();
  },

  // Check if round should end
  checkRoundEnd() {
    const allFinished = this.state.players.every(p => p.finished);
    if (allFinished) {
      this.endRound();
    }
  },

  // End the round and show results
  endRound() {
    this.state.phase = 'results';

    // Sort players by time
    const sortedPlayers = [...this.state.players].sort((a, b) => a.time - b.time);

    // Award points (1st place = 2 pts, 2nd = 1 pt, 3rd = 0 pts for 3 players)
    // For 2 players: winner gets 1 pt
    if (sortedPlayers.length === 2) {
      sortedPlayers[0].score++;
    } else if (sortedPlayers.length >= 3) {
      sortedPlayers[0].score += 2;
      sortedPlayers[1].score += 1;
    }

    this.showResults(sortedPlayers);
  },

  // Show results screen
  showResults(sortedPlayers) {
    const myPlayer = this.state.players.find(p => p.id === this.state.myPlayerId);
    const myRank = sortedPlayers.findIndex(p => p.id === this.state.myPlayerId) + 1;

    let resultText;
    if (myRank === 1) {
      resultText = 'You win this round!';
    } else if (myRank === 2) {
      resultText = sortedPlayers.length === 2 ? 'You lost this round!' : '2nd place!';
    } else {
      resultText = '3rd place!';
    }

    let timesHtml = sortedPlayers.map((p, i) => {
      const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : '🥉');
      const isMe = p.id === this.state.myPlayerId;
      return `<p>${medal} ${p.name}${isMe ? ' (You)' : ''}: ${p.time.toFixed(2)}s</p>`;
    }).join('');

    let scoresHtml = this.state.players.map(p => {
      const isMe = p.id === this.state.myPlayerId;
      return `<span class="score-item">${p.name}${isMe ? ' (You)' : ''}: ${p.score}</span>`;
    }).join(' | ');

    document.getElementById('game-area').innerHTML = `
      <div class="results">
        <h2>${resultText}</h2>
        <div class="times">
          ${timesHtml}
        </div>
        <div class="score">
          <p>${scoresHtml}</p>
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

  // Begin a round (both players)
  beginRound(word) {
    this.state.currentWord = word;
    this.state.typedChars = '';

    // Reset player state for new round
    this.state.players.forEach(p => {
      p.time = null;
      p.progress = 0;
      p.finished = false;
    });

    this.renderGameScreen();
    this.startCountdown();
  },

  // Render the main game screen
  renderGameScreen() {
    document.getElementById('game-area').innerHTML = `
      <div class="game-screen">
        <div class="round-display">
          Round ${this.state.roundNumber}
        </div>
        <div class="word-container">
          <div id="word-display" class="word-display"></div>
        </div>
        <div id="players-status" class="players-status"></div>
        <div id="countdown" class="countdown"></div>
        <div id="keyboard" class="keyboard"></div>
      </div>
    `;

    this.renderKeyboard();
    this.updateWordDisplay();
    this.renderPlayersStatus();
  },

  // Start countdown before round
  startCountdown() {
    this.state.phase = 'countdown';
    const countdownEl = document.getElementById('countdown');
    let count = 3;

    countdownEl.textContent = count;
    countdownEl.classList.add('active');

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.textContent = count;
      } else if (count === 0) {
        countdownEl.textContent = 'GO!';
      } else {
        clearInterval(interval);
        countdownEl.classList.remove('active');
        countdownEl.textContent = '';
        this.startPlaying();
      }
    }, 1000);
  },

  // Start the playing phase
  startPlaying() {
    this.state.phase = 'playing';
    this.state.startTime = Date.now();
  },

  // Render lobby screen
  renderLobby() {
    document.getElementById('game-area').innerHTML = `
      <div class="lobby">
        <h1>Scotty's Keyboard Shuffle</h1>
        <p class="subtitle">Go Bills! Type fast on a shuffled keyboard!</p>

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
      PeerConnection.createRoom();
    });

    document.getElementById('join-room-btn').addEventListener('click', () => {
      const code = document.getElementById('room-code-input').value.trim().toUpperCase();
      if (code) {
        PeerConnection.joinRoom(code);
      }
    });

    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const code = e.target.value.trim().toUpperCase();
        if (code) {
          PeerConnection.joinRoom(code);
        }
      }
    });
  },

  // Show room code after creating (host view)
  showRoomCode(code) {
    document.getElementById('room-status').innerHTML = `
      <div class="room-code-display">
        <p>Room created! Share this code:</p>
        <div class="code-container">
          <div class="code" id="room-code">${code}</div>
          <button class="btn-copy" id="copy-code-btn" title="Copy code">Copy</button>
        </div>
        <div id="player-list" class="player-list"></div>
        <p class="waiting">Waiting for players... (1-2 more can join)</p>
        <button id="start-game-btn" class="btn btn-primary" style="margin-top: 1rem; display: none;">Start Game</button>
      </div>
    `;

    document.getElementById('copy-code-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });

    document.getElementById('room-code').addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });

    document.getElementById('start-game-btn').addEventListener('click', () => {
      PeerConnection.startGame();
    });
  },

  // Show waiting room (guest view)
  showWaitingRoom(players) {
    document.getElementById('room-status').innerHTML = `
      <div class="room-code-display">
        <p>Connected to room!</p>
        <div id="player-list" class="player-list"></div>
        <p class="waiting">Waiting for host to start...</p>
      </div>
    `;
    this.updatePlayerList(players);
  },

  // Update player list display
  updatePlayerList(players) {
    const container = document.getElementById('player-list');
    if (!container) return;

    let html = '<div class="players-in-lobby">';
    players.forEach((p, i) => {
      const isHost = i === 0;
      html += `<div class="lobby-player">${p.name}${isHost ? ' (Host)' : ''}</div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    // Show/hide start button for host
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn && PeerConnection.isHost) {
      if (players.length >= 2) {
        startBtn.style.display = 'block';
        startBtn.textContent = `Start Game (${players.length} players)`;
      } else {
        startBtn.style.display = 'none';
      }
    }

    // Update waiting text
    const waitingEl = document.querySelector('.waiting');
    if (waitingEl && PeerConnection.isHost) {
      const spotsLeft = 3 - players.length;
      if (spotsLeft > 0) {
        waitingEl.textContent = `Waiting for players... (${spotsLeft} more can join)`;
      } else {
        waitingEl.textContent = 'Room is full!';
      }
    }
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

  // Start game with all players
  startGame(seed, players) {
    this.state.seed = seed;
    this.state.roundNumber = 0;
    this.state.myPlayerId = PeerConnection.playerId;

    // Initialize player data
    this.state.players = players.map(p => ({
      id: p.id,
      name: p.name,
      score: 0,
      time: null,
      progress: 0,
      finished: false
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
