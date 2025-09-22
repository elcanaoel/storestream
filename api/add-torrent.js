import WebTorrent from 'webtorrent';

// Create a singleton client instance
let client;
const getClient = () => {
  if (!client) {
    client = new WebTorrent();
  }
  return client;
};

// Store active torrents in memory
const torrents = {};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
  
  try {
    const client = getClient();
    
    client.add(magnetURI, { announce: [] }, (torrent) => {
      // Store the torrent with magnetURI to prevent duplicates
      torrents[torrent.infoHash] = {
        infoHash: torrent.infoHash,
        name: torrent.name,
        magnetURI: magnetURI,
        length: torrent.length,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        files: []
      };
      
      // Update torrent info as it becomes available
      const updateTorrentInfo = () => {
        torrents[torrent.infoHash] = {
          ...torrents[torrent.infoHash],
          length: torrent.length,
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
        };
      };
      
      // Update progress
      torrent.on('download', () => {
        updateTorrentInfo();
      });
      
      // When metadata is received, update info
      torrent.on('metadata', () => {
        updateTorrentInfo();
      });
      
      // When torrent is done
      torrent.on('done', () => {
        console.log('Torrent download finished');
        updateTorrentInfo();
      });
      
      // Handle errors
      torrent.on('error', (err) => {
        console.error('Torrent error:', err);
      });
    });
    
    // Return initial response
    res.json({
      infoHash: null, // Will be updated when torrent is ready
      name: 'Loading...',
      status: 'adding'
    });
    
  } catch (error) {
    console.error('Error adding torrent:', error);
    res.status(500).json({ error: 'Failed to add torrent' });
  }
}