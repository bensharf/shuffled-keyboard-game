// Game logic for the shuffled keyboard typing game

const Game = {
  // Standard QWERTY layout
  QWERTY_ROWS: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ],

  // Game state
  state: {
    phase: 'lobby', // lobby, countdown, playing, results
    seed: null,
    roundNumber: 0,
    currentWord: '',
    typedChars: '',
    startTime: null,
    endTime: null,
    myScore: 0,
    opponentScore: 0,
    myTime: null,
    opponentTime: null,
    opponentProgress: 0,
    shuffledLayout: null,
    keyMapping: null // Maps physical key to displayed (shuffled) key
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

    // Flatten all keys
    const allKeys = this.QWERTY_ROWS.flat();

    // Shuffle all keys
    const shuffledKeys = this.shuffleArray(allKeys, rng);

    // Rebuild rows with same structure
    let index = 0;
    const shuffledRows = this.QWERTY_ROWS.map(row => {
      const newRow = shuffledKeys.slice(index, index + row.length);
      index += row.length;
      return newRow;
    });

    // Create mapping from QWERTY position to shuffled key
    // This maps what physical key you press to what letter appears
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

      // Check if it's a letter key
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        e.preventDefault();
        // Map physical key to shuffled key
        const mappedKey = this.state.keyMapping[key];
        if (mappedKey) {
          this.handleKeyPress(mappedKey);
        }
      }
    });
  },

  // Handle key press (from on-screen or physical keyboard)
  handleKeyPress(key) {
    if (this.state.phase !== 'playing') return;

    const nextExpectedChar = this.state.currentWord[this.state.typedChars.length];

    if (key === nextExpectedChar) {
      this.state.typedChars += key;
      this.updateWordDisplay();
      this.highlightKey(key, 'correct');

      // Send progress to opponent
      PeerConnection.sendProgress(this.state.typedChars.length);

      // Check if word is complete
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

  // Update opponent progress display
  updateOpponentProgress(progress) {
    this.state.opponentProgress = progress;
    const display = document.getElementById('opponent-status');
    if (display) {
      const progressBar = '█'.repeat(progress) + '░'.repeat(this.state.currentWord.length - progress);
      display.textContent = `Opponent: [${progressBar}]`;
    }
  },

  // Complete word - player finished typing
  completeWord() {
    this.state.endTime = Date.now();
    this.state.myTime = (this.state.endTime - this.state.startTime) / 1000;
    this.state.phase = 'waiting';

    // Send completion to opponent
    PeerConnection.sendComplete(this.state.myTime);

    document.getElementById('my-status').textContent = `Your time: ${this.state.myTime.toFixed(2)}s`;

    // Check if both players finished
    this.checkRoundEnd();
  },

  // Opponent completed the word
  opponentComplete(time) {
    this.state.opponentTime = time;
    document.getElementById('opponent-status').textContent = `Opponent: ${time.toFixed(2)}s`;
    this.checkRoundEnd();
  },

  // Check if round should end
  checkRoundEnd() {
    if (this.state.myTime !== null && this.state.opponentTime !== null) {
      this.endRound();
    }
  },

  // End the round and show results
  endRound() {
    this.state.phase = 'results';

    let resultText;
    if (this.state.myTime < this.state.opponentTime) {
      this.state.myScore++;
      resultText = 'You win this round!';
    } else if (this.state.opponentTime < this.state.myTime) {
      this.state.opponentScore++;
      resultText = 'Opponent wins this round!';
    } else {
      resultText = "It's a tie!";
    }

    this.showResults(resultText);
  },

  // Show results screen
  showResults(resultText) {
    document.getElementById('game-area').innerHTML = `
      <div class="results">
        <h2>${resultText}</h2>
        <div class="times">
          <p>Your time: ${this.state.myTime.toFixed(2)}s</p>
          <p>Opponent time: ${this.state.opponentTime.toFixed(2)}s</p>
        </div>
        <div class="score">
          <p>Score: You ${this.state.myScore} - ${this.state.opponentScore} Opponent</p>
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
    this.state.myTime = null;
    this.state.opponentTime = null;
    this.state.opponentProgress = 0;

    this.renderGameScreen();
    this.startCountdown();
  },

  // Render the main game screen
  renderGameScreen() {
    document.getElementById('game-area').innerHTML = `
      <div class="game-screen">
        <div class="score-display">
          You ${this.state.myScore} - ${this.state.opponentScore} Opponent
        </div>
        <div class="word-container">
          <div id="word-display" class="word-display"></div>
        </div>
        <div class="status-container">
          <p id="my-status">Your time: --</p>
          <p id="opponent-status">Opponent: waiting...</p>
        </div>
        <div id="countdown" class="countdown"></div>
        <div id="keyboard" class="keyboard"></div>
      </div>
    `;

    this.renderKeyboard();
    this.updateWordDisplay();
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
    document.getElementById('opponent-status').textContent = 'Opponent: typing...';
  },

  // Render lobby screen
  renderLobby() {
    document.getElementById('game-area').innerHTML = `
      <div class="lobby">
        <h1>Shuffled Keyboard</h1>
        <p class="subtitle">Type fast on a shuffled keyboard!</p>

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

  // Show room code after creating
  showRoomCode(code) {
    document.getElementById('room-status').innerHTML = `
      <div class="room-code-display">
        <p>Room created! Share this code:</p>
        <div class="code-container">
          <div class="code" id="room-code">${code}</div>
          <button class="btn-copy" id="copy-code-btn" title="Copy code">Copy</button>
        </div>
        <p class="waiting">Waiting for opponent...</p>
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

    // Also make the code itself clickable to copy
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

  // Both players connected - start game
  startGame(seed) {
    this.state.seed = seed;
    this.state.myScore = 0;
    this.state.opponentScore = 0;
    this.state.roundNumber = 0;

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
