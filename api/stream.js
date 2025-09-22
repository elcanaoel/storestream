import { torrents } from './add-torrent';

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
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { infoHash, fileIndex } = req.query;
  
  if (!infoHash || !fileIndex) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  const torrent = torrents[infoHash];
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }
  
  // In a real implementation, we would stream the file content
  // For Vercel serverless functions, we can't maintain long-lived connections
  // So we return a redirect to a direct file URL or use a different approach
  
  // This is a placeholder response
  res.status(400).json({ 
    error: 'Streaming not supported in serverless environment. Use WebTorrent client in browser instead.' 
  });
}