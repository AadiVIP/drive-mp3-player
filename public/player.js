document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const elements = {
    folderUrlInput: document.getElementById('folderUrl'),
    loadBtn: document.getElementById('loadBtn'),
    statusDiv: document.getElementById('status'),
    playerContainer: document.getElementById('player-container'),
    audioPlayer: document.getElementById('audioPlayer'),
    trackTitle: document.getElementById('trackTitle'),
    playlist: document.getElementById('playlist'),
    playBtn: document.getElementById('playBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    trackCount: document.getElementById('trackCount')
  };

  // Player state
  const state = {
    tracks: [],
    currentTrackIndex: 0,
    isShuffled: false,
    originalOrder: [],
    retryCount: 0
  };

  // Format support check
  const supportedFormats = {
    mp3: true,
    m4a: true,
    ogg: true,
    wav: true
  };

  // Show status message
  function showStatus(message, type = 'info') {
    elements.statusDiv.textContent = message;
    elements.statusDiv.className = type;
    
    if (type === 'success') {
      setTimeout(() => {
        if (elements.statusDiv.textContent === message) {
          elements.statusDiv.textContent = '';
          elements.statusDiv.className = '';
        }
      }, 5000);
    }
  }

  // Format bytes to human-readable size
  function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  }

  // Load MP3 files from Google Drive
  elements.loadBtn.addEventListener('click', async () => {
    const folderUrl = elements.folderUrlInput.value.trim();
    
    if (!folderUrl) {
      showStatus('Please enter a Google Drive folder URL', 'error');
      elements.folderUrlInput.focus();
      return;
    }

    showStatus('Loading audio files...', 'loading');
    elements.playerContainer.classList.add('hidden');
    elements.playlist.innerHTML = '';
    elements.audioPlayer.src = '';
    elements.trackTitle.textContent = 'No track selected';
    state.retryCount = 0;

    try {
      const response = await fetch(`/api/files?folder=${encodeURIComponent(folderUrl)}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load files');
      }

      if (data.files.length === 0) {
        throw new Error('No playable audio files found in this folder');
      }

      state.tracks = data.files;
      state.originalOrder = [...state.tracks];
      state.currentTrackIndex = 0;
      state.isShuffled = false;
      elements.shuffleBtn.innerHTML = '<i class="fas fa-random"></i> Shuffle';
      elements.trackCount.textContent = state.tracks.length;

      renderPlaylist();
      loadTrack(state.currentTrackIndex);
      elements.playerContainer.classList.remove('hidden');
      showStatus(`Loaded ${state.tracks.length} audio tracks`, 'success');

    } catch (error) {
      console.error('Load error:', error);
      showStatus(error.message, 'error');
      
      if (error.message.includes('publicly')) {
        showStatus('Make sure both folder AND files are shared publicly', 'error');
      }
    }
  });

  // Player controls
  elements.playBtn.addEventListener('click', () => {
    if (state.tracks.length > 0) {
      elements.audioPlayer.play().catch(e => {
        showStatus('Playback failed: ' + e.message, 'error');
        handlePlaybackError();
      });
    }
  });

  elements.pauseBtn.addEventListener('click', () => {
    elements.audioPlayer.pause();
  });

  elements.prevBtn.addEventListener('click', () => {
    if (state.tracks.length === 0) return;
    
    state.currentTrackIndex = (state.currentTrackIndex - 1 + state.tracks.length) % state.tracks.length;
    loadTrack(state.currentTrackIndex);
    playCurrentTrack();
  });

  elements.nextBtn.addEventListener('click', () => {
    if (state.tracks.length === 0) return;
    
    state.currentTrackIndex = (state.currentTrackIndex + 1) % state.tracks.length;
    loadTrack(state.currentTrackIndex);
    playCurrentTrack();
  });

  elements.shuffleBtn.addEventListener('click', () => {
    if (state.tracks.length === 0) return;
    
    state.isShuffled = !state.isShuffled;
    elements.shuffleBtn.innerHTML = state.isShuffled 
      ? '<i class="fas fa-undo"></i> Unshuffle' 
      : '<i class="fas fa-random"></i> Shuffle';
    
    if (state.isShuffled) {
      // Save original order before shuffling
      if (state.originalOrder.length !== state.tracks.length) {
        state.originalOrder = [...state.tracks];
      }
      
      // Shuffle the tracks (Fisher-Yates algorithm)
      for (let i = state.tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.tracks[i], state.tracks[j]] = [state.tracks[j], state.tracks[i]];
      }
    } else {
      // Restore original order
      state.tracks = [...state.originalOrder];
    }
    
    // Find the current track in the new order
    const currentTrackId = state.tracks[state.currentTrackIndex]?.id;
    if (currentTrackId) {
      state.currentTrackIndex = state.tracks.findIndex(t => t.id === currentTrackId);
    }
    
    renderPlaylist();
  });

  // Play current track with error handling
  function playCurrentTrack() {
    elements.audioPlayer.play().catch(e => {
      showStatus('Playback failed: ' + e.message, 'error');
      handlePlaybackError();
    });
  }

  // Handle playback errors
  function handlePlaybackError() {
    state.retryCount++;
    
    if (state.retryCount < 3) {
      // Try same track again after delay
      setTimeout(() => playCurrentTrack(), 1000);
    } else {
      // Move to next track after 3 failures
      state.retryCount = 0;
      setTimeout(() => elements.nextBtn.click(), 1000);
    }
  }

  // Track ended handler
  elements.audioPlayer.addEventListener('ended', () => {
    elements.nextBtn.click();
  });

  // Error handling for audio player
  elements.audioPlayer.addEventListener('error', () => {
    showStatus('Error playing track. Trying again...', 'error');
    handlePlaybackError();
  });

  // Load a track by index
  function loadTrack(index) {
    if (state.tracks.length === 0 || index < 0 || index >= state.tracks.length) return;

    const track = state.tracks[index];
    
    // Skip unsupported formats
    if (!supportedFormats[track.type]) {
      showStatus(`Skipping ${track.type.toUpperCase()} format (may not be supported). Trying next track...`, 'warning');
      setTimeout(() => elements.nextBtn.click(), 1500);
      return;
    }

    elements.audioPlayer.src = track.url;
    elements.trackTitle.textContent = `${index + 1}. ${track.name.replace(/\.[^/.]+$/, "")}`;
    state.retryCount = 0;
    
    // Update the playlist highlighting
    const playlistItems = elements.playlist.querySelectorAll('li');
    playlistItems.forEach((item, i) => {
      item.classList.toggle('playing', i === index);
    });
  }

  // Render the playlist
  function renderPlaylist() {
    elements.playlist.innerHTML = '';
    
    state.tracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="track-number">${index + 1}.</span>
        <span class="track-name">${track.name.replace(/\.[^/.]+$/, "")}</span>
        <span class="track-meta">
          <span class="format-badge">${track.type.toUpperCase()}</span>
          ${track.size ? `<span class="file-size">${formatFileSize(track.size)}</span>` : ''}
        </span>
      `;
      
      if (index === state.currentTrackIndex) {
        li.classList.add('playing');
      }
      
      li.addEventListener('click', () => {
        state.currentTrackIndex = index;
        loadTrack(state.currentTrackIndex);
        playCurrentTrack();
      });
      
      elements.playlist.appendChild(li);
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (elements.audioPlayer.paused) elements.playBtn.click();
        else elements.pauseBtn.click();
        break;
      case 'ArrowLeft':
        elements.prevBtn.click();
        break;
      case 'ArrowRight':
        elements.nextBtn.click();
        break;
      case 'KeyS':
        elements.shuffleBtn.click();
        break;
    }
  });
});
