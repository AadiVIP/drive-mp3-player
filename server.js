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

// Enhanced folder ID extraction
function extractFolderId(url) {
  if (!url) return null;
  
  // Handle direct ID input
  if (/^[a-zA-Z0-9-_]+$/.test(url)) return url;
  
  // Handle various Google Drive URL formats
  const regexes = [
    /\/folders\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /drive\/([a-zA-Z0-9-_]+)/
  ];
  
  for (const regex of regexes) {
    const match = url.match(regex);
    if (match) return match[1];
  }
  
  return null;
}

// API endpoint with enhanced file handling
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
        correct_format: 'Should contain /folders/FOLDER_ID or just the folder ID'
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

    // Verify folder accessibility
    try {
      await axios.get(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        params: { 
          key: apiKey, 
          fields: 'id,name,capabilities/canListChildren' 
        }
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

    // Get all supported audio files in the folder
    const response = await axios.get(
      'https://www.googleapis.com/drive/v3/files',
      {
        params: {
          q: `'${folderId}' in parents and (mimeType contains 'audio/' or fileExtension = 'mp3' or fileExtension = 'flac')`,
          key: apiKey,
          fields: 'files(id,name,mimeType,fileExtension,size)',
          pageSize: 1000,
          orderBy: 'name_natural'
        }
      }
    );

    const supportedFormats = ['mp3', 'm4a', 'ogg', 'wav'];
    const files = response.data.files
      .filter(file => {
        const ext = file.fileExtension || file.name.split('.').pop().toLowerCase();
        return supportedFormats.includes(ext);
      })
      .map(file => {
        const ext = file.fileExtension || file.name.split('.').pop().toLowerCase();
        return {
          id: file.id,
          name: file.name,
          url: `/stream/${file.id}`, // Using proxy endpoint for better reliability
          type: ext,
          size: file.size
        };
      });

    if (files.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No playable audio files found',
        note: 'Ensure: 1) Files are MP3/M4A/OGG/WAV, 2) Each file is shared publicly',
        supported_formats: supportedFormats
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
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Streaming proxy endpoint
app.get('/stream/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const range = req.headers.range;
    
    const apiKey = process.env.GOOGLE_API_KEY;
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    
    const { data, headers } = await axios.get(driveUrl, {
      responseType: 'stream',
      headers: range ? { range } : {}
    });
    
    // Forward appropriate headers
    if (headers['content-range']) {
      res.setHeader('content-range', headers['content-range']);
    }
    if (headers['content-length']) {
      res.setHeader('content-length', headers['content-length']);
    }
    
    res.setHeader('content-type', 'audio/mpeg');
    data.pipe(res);
    
  } catch (error) {
    console.error('Streaming error:', error.message);
    res.status(500).send('Error streaming file');
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
