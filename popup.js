const DEFAULTS = {
  circleSize: 120,
  color: '#ffd700',
  sensitivity: 50,
  fadeDelay: 1500,
  enabled: true
};

function save(key, value) {
  chrome.storage.sync.set({ [key]: value });
}

// Load saved settings into UI
chrome.storage.sync.get(DEFAULTS, s => {
  document.getElementById('enabled').checked       = s.enabled;
  document.getElementById('circleSize').value      = s.circleSize;
  document.getElementById('circleSizeVal').textContent = s.circleSize + 'px';
  document.getElementById('sensitivity').value     = s.sensitivity;
  document.getElementById('sensitivityVal').textContent = s.sensitivity;
  document.getElementById('fadeDelay').value       = s.fadeDelay;
  document.getElementById('fadeDelayVal').textContent  = (s.fadeDelay / 1000).toFixed(1) + 's';
  document.getElementById('color').value           = s.color;
});

document.getElementById('enabled').addEventListener('change', e => {
  save('enabled', e.target.checked);
});

document.getElementById('circleSize').addEventListener('input', e => {
  const v = parseInt(e.target.value);
  document.getElementById('circleSizeVal').textContent = v + 'px';
  save('circleSize', v);
});

document.getElementById('sensitivity').addEventListener('input', e => {
  const v = parseInt(e.target.value);
  document.getElementById('sensitivityVal').textContent = v;
  save('sensitivity', v);
});

document.getElementById('fadeDelay').addEventListener('input', e => {
  const v = parseInt(e.target.value);
  document.getElementById('fadeDelayVal').textContent = (v / 1000).toFixed(1) + 's';
  save('fadeDelay', v);
});

document.getElementById('color').addEventListener('input', e => {
  save('color', e.target.value);
});
