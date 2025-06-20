document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const folderUrlInput = document.getElementById('folderUrl');
  const loadBtn = document.getElementById('loadBtn');
  const statusDiv = document.getElementById('status');
  const playerContainer = document.getElementById('player-container');
  const audioPlayer = document.getElementById('audioPlayer');
  const trackTitle = document.getElementById('trackTitle');
  const playlist = document.getElementById('playlist');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');

  // Player state
  let tracks = [];
  let currentTrackIndex = 0;
  let isShuffled = false;
  let originalOrder = [];

  // Show status message
  function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = type;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (statusDiv.textContent === message) {
          statusDiv.textContent = '';
          statusDiv.className = '';
        }
      }, 5000);
    }
  }

  // Load MP3 files from Google Drive
  loadBtn.addEventListener('click', async () => {
    const folderUrl = folderUrlInput.value.trim();
    
    if (!folderUrl) {
      showStatus('Please enter a Google Drive folder URL', 'error');
      folderUrlInput.focus();
      return;
    }

    showStatus('Loading audio files...', 'loading');
    playerContainer.classList.add('hidden');
    playlist.innerHTML = '';
    audioPlayer.src = '';
    trackTitle.textContent = 'No track selected';

    try {
      const response = await fetch(`/api/files?folder=${encodeURIComponent(folderUrl)}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load files');
      }

      if (data.files.length === 0) {
        throw new Error('No playable audio files found in this folder');
      }

      tracks = data.files;
      originalOrder = [...tracks];
      currentTrackIndex = 0;
      isShuffled = false;
      shuffleBtn.textContent = 'Shuffle';

      renderPlaylist();
      loadTrack(currentTrackIndex);
      playerContainer.classList.remove('hidden');
      showStatus(`Loaded ${tracks.length} audio tracks`, 'success');

    } catch (error) {
      console.error('Load error:', error);
      showStatus(error.message, 'error');
      
      // Show additional help for common errors
      if (error.message.includes('publicly')) {
        showStatus('Make sure both folder AND files are shared publicly', 'error');
      }
    }
  });

  // Player controls
  playBtn.addEventListener('click', () => {
    if (tracks.length > 0) {
      audioPlayer.play().catch(e => {
        showStatus('Playback failed: ' + e.message, 'error');
      });
    }
  });

  pauseBtn.addEventListener('click', () => {
    audioPlayer.pause();
  });

  prevBtn.addEventListener('click', () => {
    if (tracks.length === 0) return;
    
    currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    loadTrack(currentTrackIndex);
    audioPlayer.play().catch(e => console.error('Play error:', e));
  });

  nextBtn.addEventListener('click', () => {
    if (tracks.length === 0) return;
    
    currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
    loadTrack(currentTrackIndex);
    audioPlayer.play().catch(e => console.error('Play error:', e));
  });

  shuffleBtn.addEventListener('click', () => {
    if (tracks.length === 0) return;
    
    isShuffled = !isShuffled;
    shuffleBtn.textContent = isShuffled ? 'Unshuffle' : 'Shuffle';
    
    if (isShuffled) {
      // Save original order before shuffling
      if (originalOrder.length !== tracks.length) {
        originalOrder = [...tracks];
      }
      
      // Shuffle the tracks (Fisher-Yates algorithm)
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
    } else {
      // Restore original order
      tracks = [...originalOrder];
    }
    
    // Find the current track in the new order
    const currentTrackId = tracks[currentTrackIndex]?.id;
    if (currentTrackId) {
      currentTrackIndex = tracks.findIndex(t => t.id === currentTrackId);
    }
    
    renderPlaylist();
  });

  // Track ended handler
  audioPlayer.addEventListener('ended', () => {
    nextBtn.click();
  });

  // Error handling for audio player
  audioPlayer.addEventListener('error', () => {
    showStatus('Error playing track. Trying next track...', 'error');
    setTimeout(() => nextBtn.click(), 2000);
  });

  // Load a track by index
  function loadTrack(index) {
    if (tracks.length === 0 || index < 0 || index >= tracks.length) return;

    const track = tracks[index];
    audioPlayer.src = track.url;
    trackTitle.textContent = `${index + 1}. ${track.name}`;
    
    // Update playlist highlighting
    const playlistItems = playlist.querySelectorAll('li');
    playlistItems.forEach((item, i) => {
      item.classList.toggle('playing', i === index);
    });
  }

  // Render the playlist
  function renderPlaylist() {
    playlist.innerHTML = '';
    
    tracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.textContent = `${index + 1}. ${track.name}`;
      li.title = track.name;
      
      if (index === currentTrackIndex) {
        li.classList.add('playing');
      }
      
      li.addEventListener('click', () => {
        currentTrackIndex = index;
        loadTrack(currentTrackIndex);
        audioPlayer.play().catch(e => {
          showStatus('Playback error: ' + e.message, 'error');
        });
      });
      
      playlist.appendChild(li);
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch (e.code) {
      case 'Space':
        if (audioPlayer.paused) audioPlayer.play();
        else audioPlayer.pause();
        e.preventDefault();
        break;
      case 'ArrowLeft':
        prevBtn.click();
        break;
      case 'ArrowRight':
        nextBtn.click();
        break;
      case 'KeyS':
        shuffleBtn.click();
        break;
    }
  });
});
