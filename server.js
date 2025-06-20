require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Extract folder ID from Google Drive URL
function extractFolderId(url) {
  const regex = /\/folders\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// API endpoint to fetch MP3 files from Google Drive
app.get('/api/files', async (req, res) => {
  try {
    const folderUrl = req.query.folder;
    if (!folderUrl) {
      return res.status(400).json({ error: 'Folder URL is required' });
    }

    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return res.status(400).json({ error: 'Invalid Google Drive folder URL' });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Query Google Drive API for audio files in the folder
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files`,
      {
        params: {
          q: `'${folderId}' in parents and mimeType='audio/mpeg'`,
          key: apiKey,
          fields: 'files(id,name,webContentLink)',
        },
      }
    );

    const files = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      url: `https://docs.google.com/uc?export=download&id=${file.id}`,
    }));

    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files from Google Drive' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
