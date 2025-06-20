require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple API endpoint
app.get('/api/files', async (req, res) => {
  try {
    const folderUrl = req.query.folder;
    const folderId = folderUrl.split('/folders/')[1] || folderUrl;
    
    const response = await axios.get(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${process.env.GOOGLE_API_KEY}`
    );

    const files = response.data.files
      .filter(file => file.name.endsWith('.mp3'))
      .map(file => ({
        id: file.id,
        name: file.name,
        url: `https://drive.google.com/uc?export=download&id=${file.id}`
      }));

    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load files' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
