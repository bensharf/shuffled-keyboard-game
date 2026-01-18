// Game logic for the shuffled keyboard typing game - 2 players

const Game = {
  // Standard QWERTY layout
  QWERTY_ROWS: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ],

  // Game state
  state: {
    phase: 'lobby', // lobby, countdown, playing, waiting, results
    seed: null,
    roundNumber: 0,
    currentWord: '',
    typedChars: '',
    startTime: null,
    myTime: null,
    opponentTime: null,
    myScore: 0,
    opponentScore: 0,
    opponentProgress: 0,
    shuffledLayout: null,
    keyMapping: null,
    myName: '',
    opponentName: ''
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

  // Update opponent progress display
  updateOpponentProgress(progress) {
    this.state.opponentProgress = progress;
    const display = document.getElementById('opponent-status');
    if (display && this.state.phase === 'playing') {
      const progressBar = '█'.repeat(progress) + '░'.repeat(this.state.currentWord.length - progress);
      display.textContent = `${this.state.opponentName}: [${progressBar}]`;
    }
  },

  // Complete word - player finished typing
  completeWord() {
    const endTime = Date.now();
    this.state.myTime = (endTime - this.state.startTime) / 1000;
    this.state.phase = 'waiting';

    PeerConnection.sendComplete(this.state.myTime);

    document.getElementById('my-status').textContent = `${this.state.myName}: ${this.state.myTime.toFixed(2)}s ✓`;

    this.checkRoundEnd();
  },

  // Opponent completed the word
  opponentComplete(time) {
    this.state.opponentTime = time;
    const display = document.getElementById('opponent-status');
    if (display) {
      display.textContent = `${this.state.opponentName}: ${time.toFixed(2)}s ✓`;
    }
    this.checkRoundEnd();
  },

  // Check if round should end
  checkRoundEnd() {
    if (this.state.myTime !== null && this.state.opponentTime !== null) {
      // Small delay to let both players see the times
      setTimeout(() => this.endRound(), 500);
    }
  },

  // End the round and show results
  endRound() {
    this.state.phase = 'results';

    let resultText;
    let resultClass;
    if (this.state.myTime < this.state.opponentTime) {
      this.state.myScore++;
      resultText = 'YOU WIN!';
      resultClass = 'win';
    } else if (this.state.opponentTime < this.state.myTime) {
      this.state.opponentScore++;
      resultText = 'YOU LOSE!';
      resultClass = 'lose';
    } else {
      resultText = "IT'S A TIE!";
      resultClass = 'tie';
    }

    // Check if game is over (first to 5)
    if (this.state.myScore >= 5 || this.state.opponentScore >= 5) {
      this.showGameOver();
    } else {
      this.showResults(resultText, resultClass);
    }
  },

  // Show game over screen
  showGameOver() {
    const iWon = this.state.myScore >= 5;

    document.getElementById('game-area').innerHTML = `
      <div class="results game-over">
        <h2 class="${iWon ? 'win' : 'lose'}">${iWon ? 'VICTORY!' : 'DEFEAT!'}</h2>
        <div class="final-score">
          <p>Final Score</p>
          <div class="final-score-display">
            <span class="${iWon ? 'winner' : ''}">${this.state.myName}: ${this.state.myScore}</span>
            <span class="vs">-</span>
            <span class="${!iWon ? 'winner' : ''}">${this.state.opponentName}: ${this.state.opponentScore}</span>
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
  showResults(resultText, resultClass) {
    document.getElementById('game-area').innerHTML = `
      <div class="results">
        <h2 class="${resultClass}">${resultText}</h2>
        <div class="word-reveal">
          <p>The word was:</p>
          <div class="revealed-word">${this.state.currentWord}</div>
        </div>
        <div class="times">
          <div class="time-row ${this.state.myTime <= this.state.opponentTime ? 'winner' : ''}">
            <span>${this.state.myName}:</span>
            <span>${this.state.myTime.toFixed(2)}s</span>
          </div>
          <div class="time-row ${this.state.opponentTime < this.state.myTime ? 'winner' : ''}">
            <span>${this.state.opponentName}:</span>
            <span>${this.state.opponentTime.toFixed(2)}s</span>
          </div>
        </div>
        <div class="score">
          ${this.state.myName}: ${this.state.myScore} | ${this.state.opponentName}: ${this.state.opponentScore}
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

    this.renderCountdownScreen();
  },

  // Render countdown screen (word and keyboard hidden)
  renderCountdownScreen() {
    document.getElementById('game-area').innerHTML = `
      <div class="game-screen">
        <div class="score-display">${this.state.myName}: ${this.state.myScore} | ${this.state.opponentName}: ${this.state.opponentScore}</div>
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
    document.getElementById('game-area').innerHTML = `
      <div class="game-screen">
        <div class="round-display">Round ${this.state.roundNumber}</div>
        <div class="word-container">
          <div id="word-display" class="word-display"></div>
        </div>
        <div class="status-container">
          <p id="my-status">${this.state.myName}: typing...</p>
          <p id="opponent-status">${this.state.opponentName}: typing...</p>
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

  // Render lobby screen
  renderLobby() {
    document.getElementById('game-area').innerHTML = `
      <div class="lobby">
        <h1>Scotty's Keyboard Shuffle</h1>
        <p class="subtitle">Go Bills! Type fast on a shuffled keyboard!</p>

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
      const username = document.getElementById('username-input').value.trim() || 'Player 2';
      if (code) {
        PeerConnection.joinRoom(code, username);
      }
    });

    document.getElementById('room-code-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const code = e.target.value.trim().toUpperCase();
        const username = document.getElementById('username-input').value.trim() || 'Player 2';
        if (code) {
          PeerConnection.joinRoom(code, username);
        }
      }
    });
  },

  // Show room code after creating
  showRoomCode(code, myName) {
    document.getElementById('room-status').innerHTML = `
      <div class="room-code-display">
        <p>Hey <strong>${myName}</strong>! Share this code:</p>
        <div class="code-container">
          <div class="code" id="room-code">${code}</div>
          <button class="btn-copy" id="copy-code-btn" title="Copy code">Copy</button>
        </div>
        <p class="waiting">Waiting for opponent to join...</p>
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

  // Start game when both players connected
  startGame(seed, myName, opponentName) {
    this.state.seed = seed;
    this.state.myScore = 0;
    this.state.opponentScore = 0;
    this.state.roundNumber = 0;
    this.state.myName = myName;
    this.state.opponentName = opponentName;

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
