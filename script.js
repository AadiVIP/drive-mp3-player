const btn = document.getElementById('fetchBtn');
const folderInput = document.getElementById('folderUrl');
const playlistEl = document.getElementById('playlist');
const player = document.getElementById('player');
let tracks = [];
let current = 0;

btn.onclick = async () => {
  const url = folderInput.value.trim();
  if (!url) return alert('Please paste a folder URL.');

  const res = await fetch(`/api/files?url=${encodeURIComponent(url)}`);
  const data = await res.json();
  if (data.error) return alert(data.error);

  tracks = data.files;
  if (!tracks.length) return alert('No audio files found.');

  // Shuffle (Fisher–Yates)
  for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }

  // Populate list
  playlistEl.innerHTML = '';
  tracks.forEach((t, i) => {
    const li = document.createElement('li');
    li.textContent = `${t.name} (${t.mimeType.split('/')[1]})`;
    li.onclick = () => playTrack(i);
    playlistEl.appendChild(li);
  });

  playTrack(0);
};

function playTrack(index) {
  current = index;
  player.src = tracks[index].url;
  player.type = tracks[index].mimeType;
  player.play();
}

player.onended = () => {
  current = (current + 1) % tracks.length;
  playTrack(current);
};
