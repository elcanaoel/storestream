const express = require('express');
const WebTorrent = require('webtorrent');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 12345;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Create a new WebTorrent client
const client = new WebTorrent();

// Store active torrents
const torrents = {};

// API Routes
// Add a new torrent
app.post('/api/add-torrent', (req, res) => {
  const { magnetURI } = req.body;
  
  if (!magnetURI) {
    return res.status(400).json({ error: 'Missing magnetURI parameter' });
  }
  
  // Check if torrent already exists
  let existingTorrent = null;
  for (const infoHash in torrents) {
    if (torrents[infoHash] && torrents[infoHash].magnetURI === magnetURI) {
      existingTorrent = torrents[infoHash];
      break;
    }
  }
  
  if (existingTorrent) {
    return res.json({
      infoHash: existingTorrent.infoHash,
      name: existingTorrent.name,
      status: 'already_added'
    });
  }
  
  client.add(magnetURI, (torrent) => {
    // Store the torrent with magnetURI to prevent duplicates
    torrents[torrent.infoHash] = {
      ...torrent,
      magnetURI: magnetURI
    };
    
    // Emit progress updates
    torrent.on('download', () => {
      // Progress updates are sent via WebSocket in a real implementation
      // For now we'll just log to console
      console.log(`Progress: ${Math.round(torrent.progress * 100)}%`);
    });
    
    torrent.on('done', () => {
      console.log('Torrent download finished');
    });
    
    // Handle stream errors
    torrent.on('error', (err) => {
      console.error('Torrent error:', err);
    });
    
    res.json({
      infoHash: torrent.infoHash,
      name: torrent.name,
      status: 'added'
    });
  });
});

// Get torrent information
app.get('/api/torrent/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  
  const torrent = torrents[infoHash];
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }
  
  res.json({
    infoHash: torrent.infoHash,
    name: torrent.name,
    length: torrent.length,
    downloaded: torrent.downloaded,
    progress: torrent.progress,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    numPeers: torrent.numPeers,
    files: torrent.files ? torrent.files.map((file, index) => ({
      name: file.name,
      length: file.length,
      path: file.path,
      index: index
    })) : []
  });
});

// Stream a file from the torrent
app.get('/api/stream/:infoHash/:fileIndex', (req, res) => {
  const { infoHash, fileIndex } = req.params;
  
  const torrent = torrents[infoHash];
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }
  
  if (!torrent.files) {
    return res.status(404).json({ error: 'Files not ready yet' });
  }
  
  const file = torrent.files[fileIndex];
  
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Determine MIME type based on file extension or use a default
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg'
  };
  
  // Extract extension and look up MIME type
  const path = require('path');
  const ext = path.extname(file.name).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  
  // Handle range requests for HTML5 video streaming
  const range = req.headers.range;
  
  if (range) {
    // Parse range header
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
    const chunkSize = (end - start) + 1;
    
    // Send partial content response
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${file.length}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
    });
    
    // Create and pipe the stream
    const stream = file.createReadStream({ start: start, end: end });
    
    // Handle stream errors
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
    // Handle client disconnect
    req.on('close', () => {
      stream.destroy();
    });
    
    stream.pipe(res);
  } else {
    // Send full file with proper headers for HTML5 media
    res.writeHead(200, {
      'Content-Length': file.length,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
      'Content-Disposition': 'inline' // Important for HTML5 media playback
    });
    
    // Create and pipe the stream
    const stream = file.createReadStream();
    
    // Handle stream errors
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    
    // Handle client disconnect
    req.on('close', () => {
      stream.destroy();
    });
    
    stream.pipe(res);
  }
});

// Serve the React app for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});