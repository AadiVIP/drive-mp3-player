/**
 * Based on Google Drive API examples:
 * - Drive v3: https://developers.google.com/drive/api/v3/reference/files/list
 * Inspired by: various GitHub projects like "drive-stream" and MDN audio streaming tutorials.
 */
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const API_KEY = process.env.GOOGLE_API_KEY;
const PORT = process.env.PORT || 3000;

// Supported MIME types for audio
const AUDIO_MIME_TYPES = [
  'audio/mpeg',   // .mp3
  'audio/wav',    // .wav
  'audio/ogg'     // .ogg
];

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple health-check for uptime monitors
app.get('/health', (req, res) => res.send('OK'));

// API endpoint: list audio files in folder
app.get('/api/files', async (req, res) => {
  const folderUrl = req.query.url;
  if (!folderUrl) return res.status(400).json({ error: 'Missing folder URL' });

  // Extract folder ID from URL
  const match = folderUrl.match(/[-\w]{25,}/);
  if (!match) return res.status(400).json({ error: 'Invalid folder URL' });
  const folderId = match[0];

  // Build query for multiple MIME types
  const mimeFilters = AUDIO_MIME_TYPES.map(type => `mimeType='${type}'`).join('+or+');
  const query = `('${folderId}'+in+parents)+and+(${mimeFilters})`;
  const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&key=${API_KEY}`;

  try {
    const response = await fetch(driveUrl);
    const data = await response.json();
    if (data.error) throw data.error;

    // Map to download/stream links
    const files = data.files.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      url: `https://docs.google.com/uc?export=download&id=${f.id}`
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
