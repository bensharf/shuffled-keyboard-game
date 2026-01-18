// P2P connection handling using PeerJS

const PeerConnection = {
  peer: null,
  connection: null,
  isHost: false,
  roomCode: null,

  // Generate a random room code
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,1,I)
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },

  // Generate a game seed
  generateSeed() {
    return Math.floor(Math.random() * 2147483647);
  },

  // Create a room (host)
  createRoom() {
    this.isHost = true;
    this.roomCode = this.generateRoomCode();

    Game.showConnecting();

    // Create peer with room code as ID
    this.peer = new Peer(this.roomCode, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      console.log('Room created with ID:', id);
      Game.showRoomCode(id);
    });

    this.peer.on('connection', (conn) => {
      console.log('Guest connected');
      this.connection = conn;
      this.setupConnection();

      // Start the game with a seed
      const seed = this.generateSeed();
      this.send({
        type: 'game-start',
        seed: seed
      });

      Game.startGame(seed);
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
      this.connection = this.peer.connect(code, {
        reliable: true
      });

      this.connection.on('open', () => {
        console.log('Connected to host');
        this.setupConnection();
      });

      this.connection.on('error', (err) => {
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

  // Setup connection event handlers
  setupConnection() {
    this.connection.on('data', (data) => {
      this.handleMessage(data);
    });

    this.connection.on('close', () => {
      console.log('Connection closed');
      Game.showError('Opponent disconnected.');
      this.cleanup();
    });
  },

  // Handle incoming messages
  handleMessage(data) {
    console.log('Received:', data);

    switch (data.type) {
      case 'game-start':
        // Guest receives game start with seed
        Game.startGame(data.seed);
        break;

      case 'start-round':
        // Guest receives round start
        Game.beginRound(data.word);
        break;

      case 'progress':
        // Opponent typing progress
        Game.updateOpponentProgress(data.progress);
        break;

      case 'complete':
        // Opponent finished typing
        Game.opponentComplete(data.time);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  },

  // Send a message to the other player
  send(data) {
    if (this.connection && this.connection.open) {
      this.connection.send(data);
    }
  },

  // Send typing progress
  sendProgress(progress) {
    this.send({
      type: 'progress',
      progress: progress
    });
  },

  // Send completion
  sendComplete(time) {
    this.send({
      type: 'complete',
      time: time
    });
  },

  // Send start round (host only)
  sendStartRound(roundData) {
    this.send({
      type: 'start-round',
      roundNumber: roundData.roundNumber,
      word: roundData.word
    });
  },

  // Cleanup connection
  cleanup() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
};
