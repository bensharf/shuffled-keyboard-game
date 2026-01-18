// P2P connection handling using PeerJS - up to 3 players with ready system

const PeerConnection = {
  peer: null,
  connections: [], // Array of connections (for host)
  hostConnection: null, // Single connection to host (for guests)
  isHost: false,
  roomCode: null,
  myName: null,
  myId: null,
  players: [], // {id, name, ready}
  allReady: false,

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
  createRoom(username) {
    this.isHost = true;
    this.roomCode = this.generateRoomCode();
    this.myName = username;
    this.myId = this.generatePlayerId();
    this.players = [{id: this.myId, name: username, ready: false}];

    Game.showConnecting();

    this.peer = new Peer(this.roomCode, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      console.log('Room created with ID:', id);
      Game.showReadyLobby(this.players, this.myId);
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

      console.log('Guest connecting...');
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
      console.log('Guest connected, waiting for their info...');
    });

    conn.on('data', (data) => {
      this.handleHostMessage(data, conn);
    });

    conn.on('close', () => {
      console.log('Guest disconnected:', conn.odPlayerId);
      this.connections = this.connections.filter(c => c !== conn);
      this.players = this.players.filter(p => p.id !== conn.odPlayerId);
      this.broadcastPlayerList();
      Game.showReadyLobby(this.players, this.myId);
    });
  },

  // Handle messages as host
  handleHostMessage(data, fromConn) {
    console.log('Host received:', data);

    switch (data.type) {
      case 'join-request':
        const newId = this.generatePlayerId();
        fromConn.odPlayerId = newId;
        this.players.push({id: newId, name: data.name, ready: false});

        // Send player their ID and current player list
        fromConn.send({
          type: 'join-accepted',
          playerId: newId,
          players: this.players,
          roomCode: this.roomCode
        });

        this.broadcastPlayerList();
        Game.showReadyLobby(this.players, this.myId);
        break;

      case 'ready-toggle':
        const player = this.players.find(p => p.id === data.playerId);
        if (player) {
          player.ready = data.ready;
          this.broadcastPlayerList();
          Game.showReadyLobby(this.players, this.myId);
          this.checkAllReady();
        }
        break;

      case 'progress':
        this.broadcast({
          type: 'progress',
          playerId: fromConn.odPlayerId,
          progress: data.progress
        }, fromConn);
        Game.updatePlayerProgress(fromConn.odPlayerId, data.progress);
        break;

      case 'complete':
        this.broadcast({
          type: 'complete',
          playerId: fromConn.odPlayerId,
          time: data.time
        }, fromConn);
        Game.playerComplete(fromConn.odPlayerId, data.time);
        break;
    }
  },

  // Join an existing room (guest)
  joinRoom(code, username) {
    this.isHost = false;
    this.roomCode = code;
    this.myName = username;

    Game.showConnecting();

    this.peer = new Peer({
      debug: 1
    });

    this.peer.on('open', () => {
      console.log('Connecting to room:', code);
      this.hostConnection = this.peer.connect(code, {
        reliable: true
      });

      this.hostConnection.on('open', () => {
        console.log('Connected to host, sending join request...');
        this.hostConnection.send({
          type: 'join-request',
          name: this.myName
        });
      });

      this.hostConnection.on('data', (data) => {
        this.handleGuestMessage(data);
      });

      this.hostConnection.on('close', () => {
        console.log('Disconnected from host');
        Game.showError('Host disconnected.');
        this.cleanup();
      });

      this.hostConnection.on('error', (err) => {
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

  // Handle messages as guest
  handleGuestMessage(data) {
    console.log('Guest received:', data);

    switch (data.type) {
      case 'room-full':
        Game.showError('Room is full (max 3 players).');
        this.cleanup();
        break;

      case 'join-accepted':
        this.myId = data.playerId;
        this.players = data.players;
        Game.showReadyLobby(this.players, this.myId);
        break;

      case 'player-list':
        this.players = data.players;
        Game.showReadyLobby(this.players, this.myId);
        break;

      case 'game-start':
        Game.startGame(data.seed, this.players, this.myId);
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
    }
  },

  // Broadcast to all guests
  broadcast(data, excludeConn = null) {
    this.connections.forEach(conn => {
      if (conn !== excludeConn && conn.open) {
        conn.send(data);
      }
    });
  },

  // Broadcast updated player list to all guests
  broadcastPlayerList() {
    this.broadcast({
      type: 'player-list',
      players: this.players
    });
  },

  // Toggle ready status
  toggleReady() {
    const me = this.players.find(p => p.id === this.myId);
    if (me) {
      me.ready = !me.ready;

      if (this.isHost) {
        this.broadcastPlayerList();
        Game.showReadyLobby(this.players, this.myId);
        this.checkAllReady();
      } else {
        this.hostConnection.send({
          type: 'ready-toggle',
          playerId: this.myId,
          ready: me.ready
        });
      }
    }
  },

  // Check if all players are ready (host only)
  checkAllReady() {
    if (!this.isHost) return;
    if (this.players.length < 2) return; // Need at least 2 players

    const allReady = this.players.every(p => p.ready);
    if (allReady && !this.allReady) {
      this.allReady = true;
      // Start game after a short delay
      setTimeout(() => {
        const seed = this.generateSeed();
        this.broadcast({
          type: 'game-start',
          seed: seed,
          players: this.players
        });
        Game.startGame(seed, this.players, this.myId);
      }, 500);
    }
  },

  // Send a message
  send(data) {
    if (this.isHost) {
      this.broadcast(data);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(data);
    }
  },

  // Send typing progress
  sendProgress(progress) {
    if (this.isHost) {
      this.broadcast({
        type: 'progress',
        playerId: this.myId,
        progress: progress
      });
    } else {
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
        playerId: this.myId,
        time: time
      });
    } else {
      this.send({
        type: 'complete',
        time: time
      });
    }
  },

  // Send start round (host only)
  sendStartRound(roundData) {
    this.broadcast({
      type: 'start-round',
      roundNumber: roundData.roundNumber,
      word: roundData.word
    });
  },

  // Cleanup
  cleanup() {
    this.connections.forEach(conn => conn.close());
    this.connections = [];
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
};
