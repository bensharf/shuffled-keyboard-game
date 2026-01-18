// P2P connection handling using PeerJS - supports up to 3 players

const PeerConnection = {
  peer: null,
  connections: [], // Array of connections (for host) or single connection (for guest)
  isHost: false,
  roomCode: null,
  playerId: null, // Unique ID for this player
  playerName: null,
  connectedPlayers: [], // List of {id, name} for all players in the game

  // Generate a random room code
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },

  // Generate a player ID
  generatePlayerId() {
    return 'P' + Math.random().toString(36).substr(2, 6).toUpperCase();
  },

  // Generate a game seed
  generateSeed() {
    return Math.floor(Math.random() * 2147483647);
  },

  // Create a room (host)
  createRoom() {
    this.isHost = true;
    this.roomCode = this.generateRoomCode();
    this.playerId = this.generatePlayerId();
    this.playerName = 'Player 1';
    this.connectedPlayers = [{id: this.playerId, name: this.playerName}];

    Game.showConnecting();

    this.peer = new Peer(this.roomCode, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      console.log('Room created with ID:', id);
      Game.showRoomCode(id);
      Game.updatePlayerList(this.connectedPlayers);
    });

    this.peer.on('connection', (conn) => {
      if (this.connections.length >= 2) {
        // Room is full (host + 2 guests = 3 players max)
        conn.on('open', () => {
          conn.send({ type: 'room-full' });
          setTimeout(() => conn.close(), 100);
        });
        return;
      }

      console.log('Guest connected');
      this.connections.push(conn);
      this.setupHostConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        Game.showError('Room code already in use. Please try again.');
      } else {
        Game.showError('Connection error. Please try again.');
      }
    });
  },

  // Setup connection handler for host
  setupHostConnection(conn) {
    conn.on('open', () => {
      const guestId = this.generatePlayerId();
      const guestName = 'Player ' + (this.connectedPlayers.length + 1);

      conn.playerId = guestId;
      conn.playerName = guestName;

      this.connectedPlayers.push({id: guestId, name: guestName});

      // Send player info to the new guest
      conn.send({
        type: 'player-info',
        playerId: guestId,
        playerName: guestName,
        allPlayers: this.connectedPlayers
      });

      // Notify all existing guests about the updated player list
      this.broadcast({
        type: 'player-list-update',
        players: this.connectedPlayers
      });

      Game.updatePlayerList(this.connectedPlayers);
    });

    conn.on('data', (data) => {
      this.handleHostMessage(data, conn);
    });

    conn.on('close', () => {
      console.log('Guest disconnected:', conn.playerId);
      this.connections = this.connections.filter(c => c !== conn);
      this.connectedPlayers = this.connectedPlayers.filter(p => p.id !== conn.playerId);

      this.broadcast({
        type: 'player-list-update',
        players: this.connectedPlayers
      });

      Game.updatePlayerList(this.connectedPlayers);

      if (Game.state.phase === 'playing' || Game.state.phase === 'countdown') {
        Game.handlePlayerDisconnect(conn.playerId);
      }
    });
  },

  // Handle messages as host
  handleHostMessage(data, fromConn) {
    console.log('Host received:', data);

    switch (data.type) {
      case 'progress':
        // Relay progress to all other players
        this.broadcast({
          type: 'progress',
          playerId: fromConn.playerId,
          progress: data.progress
        }, fromConn);
        Game.updatePlayerProgress(fromConn.playerId, data.progress);
        break;

      case 'complete':
        // Relay completion to all other players
        this.broadcast({
          type: 'complete',
          playerId: fromConn.playerId,
          time: data.time
        }, fromConn);
        Game.playerComplete(fromConn.playerId, data.time);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  },

  // Join an existing room (guest)
  joinRoom(code) {
    this.isHost = false;
    this.roomCode = code;

    Game.showConnecting();

    this.peer = new Peer({
      debug: 1
    });

    this.peer.on('open', () => {
      console.log('Connecting to room:', code);
      const conn = this.peer.connect(code, {
        reliable: true
      });

      conn.on('open', () => {
        console.log('Connected to host');
        this.connections = [conn];
        this.setupGuestConnection(conn);
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        Game.showError('Failed to connect. Check the room code.');
      });
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'peer-unavailable') {
        Game.showError('Room not found. Check the code and try again.');
      } else {
        Game.showError('Connection error. Please try again.');
      }
    });
  },

  // Setup connection handler for guest
  setupGuestConnection(conn) {
    conn.on('data', (data) => {
      this.handleGuestMessage(data);
    });

    conn.on('close', () => {
      console.log('Disconnected from host');
      Game.showError('Host disconnected.');
      this.cleanup();
    });
  },

  // Handle messages as guest
  handleGuestMessage(data) {
    console.log('Guest received:', data);

    switch (data.type) {
      case 'room-full':
        Game.showError('Room is full (max 3 players).');
        this.cleanup();
        break;

      case 'player-info':
        this.playerId = data.playerId;
        this.playerName = data.playerName;
        this.connectedPlayers = data.allPlayers;
        Game.showWaitingRoom(this.connectedPlayers);
        break;

      case 'player-list-update':
        this.connectedPlayers = data.players;
        Game.updatePlayerList(this.connectedPlayers);
        break;

      case 'game-start':
        Game.startGame(data.seed, data.players);
        break;

      case 'start-round':
        Game.beginRound(data.word);
        break;

      case 'progress':
        Game.updatePlayerProgress(data.playerId, data.progress);
        break;

      case 'complete':
        Game.playerComplete(data.playerId, data.time);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  },

  // Broadcast message to all connections (optionally exclude one)
  broadcast(data, excludeConn = null) {
    this.connections.forEach(conn => {
      if (conn !== excludeConn && conn.open) {
        conn.send(data);
      }
    });
  },

  // Send message (guest sends to host, host broadcasts)
  send(data) {
    if (this.isHost) {
      this.broadcast(data);
    } else if (this.connections[0] && this.connections[0].open) {
      this.connections[0].send(data);
    }
  },

  // Send typing progress
  sendProgress(progress) {
    if (this.isHost) {
      // Host broadcasts their own progress
      this.broadcast({
        type: 'progress',
        playerId: this.playerId,
        progress: progress
      });
    } else {
      // Guest sends to host
      this.send({
        type: 'progress',
        progress: progress
      });
    }
  },

  // Send completion
  sendComplete(time) {
    if (this.isHost) {
      this.broadcast({
        type: 'complete',
        playerId: this.playerId,
        time: time
      });
    } else {
      this.send({
        type: 'complete',
        time: time
      });
    }
  },

  // Start the game (host only)
  startGame() {
    if (!this.isHost) return;

    const seed = this.generateSeed();

    this.broadcast({
      type: 'game-start',
      seed: seed,
      players: this.connectedPlayers
    });

    Game.startGame(seed, this.connectedPlayers);
  },

  // Send start round (host only)
  sendStartRound(roundData) {
    this.broadcast({
      type: 'start-round',
      roundNumber: roundData.roundNumber,
      word: roundData.word
    });
  },

  // Cleanup connection
  cleanup() {
    this.connections.forEach(conn => conn.close());
    this.connections = [];
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
};
