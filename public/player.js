document.addEventListener('DOMContentLoaded', () => {
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

  let tracks = [];
  let currentTrackIndex = 0;
  let isShuffled = false;
  let originalOrder = [];

  // Load MP3 files from Google Drive
  loadBtn.addEventListener('click', async () => {
    const folderUrl = folderUrlInput.value.trim();
    if (!folderUrl) {
      showStatus('Please enter a Google Drive folder URL', 'error');
      return;
    }

    showStatus('Loading MP3 files...', 'loading');

    try {
      const response = await fetch(`/api/files?folder=${encodeURIComponent(folderUrl)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.length === 0) {
        throw new Error('No MP3 files found in this folder');
      }

      tracks = data;
      originalOrder = [...tracks];
      currentTrackIndex = 0;
      isShuffled = false;

      renderPlaylist();
      loadTrack(currentTrackIndex);
      playerContainer.classList.remove('hidden');
      showStatus(`Loaded ${tracks.length} MP3 files`, 'success');
    } catch (error) {
      console.error('Error:', error);
      showStatus(error.message, 'error');
      playerContainer.classList.add('hidden');
    }
  });

  // Player controls
  playBtn.addEventListener('click', () => {
    audioPlayer.play();
  });

  pauseBtn.addEventListener('click', () => {
    audioPlayer.pause();
  });

  prevBtn.addEventListener('click', () => {
    if (currentTrackIndex > 0) {
      currentTrackIndex--;
    } else {
      currentTrackIndex = tracks.length - 1;
    }
    loadTrack(currentTrackIndex);
    audioPlayer.play();
  });

  nextBtn.addEventListener('click', () => {
    if (currentTrackIndex < tracks.length - 1) {
      currentTrackIndex++;
    } else {
      currentTrackIndex = 0;
    }
    loadTrack(currentTrackIndex);
    audioPlayer.play();
  });

  shuffleBtn.addEventListener('click', () => {
    isShuffled = !isShuffled;
    shuffleBtn.textContent = isShuffled ? 'Unshuffle' : 'Shuffle';
    
    if (isShuffled) {
      // Save original order before shuffling
      if (originalOrder.length !== tracks.length) {
        originalOrder = [...tracks];
      }
      
      // Shuffle the tracks
      tracks = shuffleArray([...originalOrder]);
      
      // Find the current track in the new shuffled order
      const currentTrack = tracks[currentTrackIndex];
      currentTrackIndex = tracks.findIndex(t => t.id === currentTrack.id);
    } else {
      // Restore original order
      tracks = [...originalOrder];
      
      // Find the current track in the original order
      const currentTrack = tracks[currentTrackIndex];
      currentTrackIndex = originalOrder.findIndex(t => t.id === currentTrack.id);
    }
    
    renderPlaylist();
  });

  // When a track ends, play the next one
  audioPlayer.addEventListener('ended', () => {
    nextBtn.click();
  });

  // Load a track by index
  function loadTrack(index) {
    if (tracks.length === 0 || index < 0 || index >= tracks.length) return;

    const track = tracks[index];
    audioPlayer.src = track.url;
    trackTitle.textContent = track.name;
    
    // Update the playlist highlighting
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
      li.textContent = track.name;
      li.addEventListener('click', () => {
        currentTrackIndex = index;
        loadTrack(currentTrackIndex);
        audioPlayer.play();
      });
      if (index === currentTrackIndex) {
        li.classList.add('playing');
      }
      playlist.appendChild(li);
    });
  }

  // Show status messages
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }

  // Helper function to shuffle an array
  function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
});
