import { getClient, torrents } from './add-torrent';

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
  
  const { infoHash } = req.query;
  
  if (!infoHash) {
    return res.status(400).json({ error: 'Missing infoHash parameter' });
  }
  
  const torrent = torrents[infoHash];
  
  if (!torrent) {
    return res.status(404).json({ error: 'Torrent not found' });
  }
  
  res.json(torrent);
}