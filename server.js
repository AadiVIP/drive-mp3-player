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

// Improved folder ID extraction
function extractFolderId(url) {
  // Handle both full URLs and direct IDs
  if (!url.includes('://')) {
    // If it's just an ID
    return url;
  }
  
  const regex = /\/folders\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// API endpoint with enhanced error handling
app.get('/api/files', async (req, res) => {
  try {
    const { folder } = req.query;
    
    if (!folder) {
      return res.status(400).json({ 
        success: false,
        error: 'Folder URL or ID is required',
        example: 'https://drive.google.com/drive/folders/1zjKqnK2r28-dZaZRK9BmYo7eXgMwXNzN'
      });
    }

    const folderId = extractFolderId(folder);
    if (!folderId) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid Google Drive URL format',
        correct_format: 'Should contain /folders/FOLDER_ID'
      });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_API_KEY is missing from environment variables');
      return res.status(500).json({ 
        success: false,
        error: 'Server configuration error',
        message: 'Google Drive API key is not configured'
      });
    }

    // First verify the folder exists and is accessible
    try {
      await axios.get(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        params: { key: apiKey, fields: 'id,name' }
      });
    } catch (folderError) {
      console.error('Folder access error:', folderError.response?.data || folderError.message);
      return res.status(403).json({
        success: false,
        error: 'Cannot access folder',
        details: folderError.response?.data?.error?.message || 'Make sure the folder is shared publicly',
        solution: 'Right-click folder → Share → "Anyone with the link" as "Viewer"'
      });
    }

    // Get all audio files in the folder
    const response = await axios.get(
      'https://www.googleapis.com/drive/v3/files',
      {
        params: {
          q: `'${folderId}' in parents and (mimeType='audio/mpeg' or mimeType='audio/mp3' or mimeType contains 'audio/')`,
          key: apiKey,
          fields: 'files(id,name,mimeType,webContentLink)',
          pageSize: 1000
        }
      }
    );

    const files = response.data.files
      .filter(file => file.mimeType.includes('audio/'))
      .map(file => ({
        id: file.id,
        name: file.name,
        url: `https://drive.google.com/uc?export=download&id=${file.id}`,
        directLink: file.webContentLink || `https://drive.google.com/file/d/${file.id}/view`
      }));

    if (files.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No playable audio files found',
        note: 'Ensure: 1) Files are MP3s, 2) Each file is shared publicly, 3) Files have supported audio MIME type'
      });
    }

    res.json({ success: true, files });

  } catch (error) {
    console.error('API Error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to process request',
      details: error.response?.data?.error?.message || error.message,
      possible_fix: 'Check server logs for detailed error'
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Google Drive API key: ${process.env.GOOGLE_API_KEY ? 'Configured' : 'MISSING!'}`);
});
