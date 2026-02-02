/**
 * Popup Script for Pomodoro Timer Extension
 * Handles UI interactions and state synchronization with background worker
 */

// DOM Elements
const timerDisplay = document.getElementById('timerDisplay');
const timerLabel = document.getElementById('timerLabel');
const sessionType = document.getElementById('sessionType');
const cycleInfo = document.getElementById('cycleInfo');
const todayCount = document.getElementById('todayCount');
const weekCount = document.getElementById('weekCount');
const monthCount = document.getElementById('monthCount');
const totalCount = document.getElementById('totalCount');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const themeToggle = document.getElementById('themeToggle');
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const workDurationInput = document.getElementById('workDuration');
const shortBreakDurationInput = document.getElementById('shortBreakDuration');
const longBreakDurationInput = document.getElementById('longBreakDuration');
const longBreakIntervalInput = document.getElementById('longBreakInterval');
const autoStartBreaksInput = document.getElementById('autoStartBreaks');
const autoStartWorkInput = document.getElementById('autoStartWork');
const desktopNotificationsInput = document.getElementById('desktopNotifications');
const soundNotificationsInput = document.getElementById('soundNotifications');
const soundTypeSelect = document.getElementById('soundType');
const tickingSoundInput = document.getElementById('tickingSound');
const saveSettingsBtn = document.getElementById('saveSettings');

// State
let currentState = null;
let currentSettings = null;
let updateInterval = null;
let lastTickSecond = null;
let tickAudioContext = null;

const DEFAULT_SETTINGS = {
  durations: {
    work: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  },
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  notifications: {
    desktop: true,
    sound: true,
    soundType: 'beep'
  },
  tickingSound: {
    enabled: false
  }
};
// Checkpoint-based timer (Marinara Timer style)
let checkpointStartAt = null; // When current period started (timestamp)
let checkpointElapsed = 0; // Time already elapsed before checkpoint (seconds)
let checkpointDuration = 0; // Total duration for current period (seconds)

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'success', 'error', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'error', duration = 3000) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Set icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.error}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close">×</button>
  `;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  const closeToast = () => {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };
  
  closeBtn.addEventListener('click', closeToast);
  
  // Auto-close after duration
  if (duration > 0) {
    setTimeout(closeToast, duration);
  }
  
  return toast;
}

/**
 * Initialize popup - load state and set up event listeners
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await loadSettings();
  await updateUI();
  setupEventListeners();
  startUIUpdate();
});

/**
 * Set up event listeners
 */
function setupEventListeners() {
  startPauseBtn.addEventListener('click', handleStartPause);
  resetBtn.addEventListener('click', handleReset);
  skipBtn.addEventListener('click', handleSkip);
  themeToggle.addEventListener('click', toggleTheme);
  settingsToggle.addEventListener('click', toggleSettings);
  saveSettingsBtn.addEventListener('click', handleSaveSettings);
  soundNotificationsInput.addEventListener('change', syncSoundTypeState);
}

function syncSoundTypeState() {
  soundTypeSelect.disabled = !soundNotificationsInput.checked;
}

/**
 * Load theme preference from storage
 */
async function loadTheme() {
  try {
    const result = await chrome.storage.local.get(['theme']);
    const theme = result.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  } catch (error) {
    console.error('Error loading theme:', error);
  }
}

/**
 * Toggle between light and dark theme
 */
async function toggleTheme() {
  try {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    await chrome.storage.local.set({ theme: newTheme });
    updateThemeIcon(newTheme);
  } catch (error) {
    console.error('Error toggling theme:', error);
  }
}

/**
 * Update theme icon based on current theme
 */
function updateThemeIcon(theme) {
  const icon = themeToggle.querySelector('.theme-icon');
  icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/**
 * Load current state from background worker
 * Only syncs checkpoint when state actually changes (Marinara Timer style)
 */
async function updateUI() {
  try {
    // Get timer state
    const stateResponse = await chrome.runtime.sendMessage({ action: 'getState' });
    if (stateResponse && stateResponse.success) {
      const newState = stateResponse.state;
      
      // Check if state actually changed (session, running status, or pause status)
      const stateChanged = !currentState || 
        currentState.currentSession !== newState.currentSession ||
        currentState.isRunning !== newState.isRunning ||
        currentState.isPaused !== newState.isPaused ||
        currentState.initialDuration !== newState.initialDuration;
      
      // Update checkpoint only when state changes (Marinara Timer style)
      if (stateChanged) {
        if (newState.isRunning && !newState.isPaused) {
          // Timer is running - set checkpoint
          checkpointStartAt = Date.now();
          checkpointElapsed = newState.initialDuration - newState.timeRemaining;
          checkpointDuration = newState.initialDuration;
        } else if (newState.isPaused) {
          // Timer is paused - update checkpoint elapsed and stop checkpoint
          if (checkpointStartAt) {
            checkpointElapsed += (Date.now() - checkpointStartAt) / 1000;
            checkpointStartAt = null;
          }
          // If no checkpoint was set, calculate from state
          if (!checkpointStartAt && newState.initialDuration) {
            checkpointElapsed = newState.initialDuration - newState.timeRemaining;
            checkpointDuration = newState.initialDuration;
          }
        } else {
          // Timer is idle - reset checkpoint
          checkpointStartAt = null;
          checkpointElapsed = 0;
          checkpointDuration = newState.timeRemaining;
        }
      }
      
      currentState = newState;
      updateTimerDisplay();
      updateSessionInfo();
      updateButtons();
    }
    
    await updateStats();
  } catch (error) {
    console.error('Error updating UI:', error);
  }
}

/**
 * Update session statistics display
 */
async function updateStats() {
  try {
    const statsResponse = await chrome.runtime.sendMessage({ action: 'getStats' });
    if (statsResponse && statsResponse.success && statsResponse.stats) {
      todayCount.textContent = statsResponse.stats.today;
      weekCount.textContent = statsResponse.stats.week;
      monthCount.textContent = statsResponse.stats.month;
      totalCount.textContent = statsResponse.stats.total;
      return;
    }
  } catch (error) {
    console.error('Error updating stats:', error);
  }

  todayCount.textContent = '0';
  weekCount.textContent = '0';
  monthCount.textContent = '0';
  totalCount.textContent = '0';
}

function getRemainingSeconds() {
  if (!currentState) return 0;
  
  // Calculate remaining time using checkpoint (Marinara Timer style)
  if (currentState.isRunning && !currentState.isPaused && checkpointStartAt) {
    const elapsed = (Date.now() - checkpointStartAt) / 1000;
    return Math.max(0, checkpointDuration - (checkpointElapsed + elapsed));
  }

  if (currentState.isPaused) {
    return Math.max(0, checkpointDuration - checkpointElapsed);
  }

  return currentState.timeRemaining;
}

/**
 * Update timer display with current time
 * Uses checkpoint-based calculation (Marinara Timer style)
 */
function updateTimerDisplay() {
  if (!currentState) return;
  
  const remaining = getRemainingSeconds();
  
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  timerDisplay.textContent = formattedTime;
  
  // Update timer container session attribute for styling
  const timerContainer = document.querySelector('.timer-container');
  if (timerContainer) {
    timerContainer.setAttribute('data-session', currentState.currentSession);
  }
  
  // Update label
  if (currentState.isRunning && !currentState.isPaused) {
    timerLabel.textContent = 'Running';
    timerDisplay.classList.add('running');
  } else if (currentState.isPaused) {
    timerLabel.textContent = 'Paused';
    timerDisplay.classList.remove('running');
  } else {
    timerLabel.textContent = 'Ready to start';
    timerDisplay.classList.remove('running');
  }
}

/**
 * Update session type and cycle information
 */
function updateSessionInfo() {
  if (!currentState) return;
  
  const sessionNames = {
    work: 'Work Session',
    shortBreak: 'Short Break',
    longBreak: 'Long Break'
  };
  
  sessionType.textContent = sessionNames[currentState.currentSession] || 'Work Session';
  const interval = currentSettings?.longBreakInterval ?? 4;
  if (interval > 0) {
    const cyclePosition = currentState.cycleCount === 0
      ? 0
      : (currentState.cycleCount % interval || interval);
    cycleInfo.textContent = `Cycle ${cyclePosition}/${interval}`;
  } else {
    cycleInfo.textContent = 'Cycle -';
  }
}

/**
 * Update button states and labels
 */
async function updateButtons() {
  if (!currentState) return;
  
  const btnIcon = startPauseBtn.querySelector('.btn-icon');
  const btnText = startPauseBtn.querySelector('.btn-text');
  
  if (currentState.isRunning && !currentState.isPaused) {
    btnIcon.textContent = '⏸';
    btnText.textContent = 'Pause';
    startPauseBtn.classList.remove('paused');
  } else if (currentState.isPaused) {
    btnIcon.textContent = '▶';
    btnText.textContent = 'Resume';
    startPauseBtn.classList.add('paused');
  } else {
    btnIcon.textContent = '▶';
    btnText.textContent = 'Start';
    startPauseBtn.classList.remove('paused');
  }
  
  // Disable skip button if timer hasn't started
  const initialDuration = await getInitialDuration();
  skipBtn.disabled = !currentState.isRunning && !currentState.isPaused && currentState.timeRemaining === initialDuration;
}

/**
 * Get initial duration for current session type
 */
async function getInitialDuration() {
  try {
    const durations = currentSettings?.durations;
    if (durations) {
      return durations[currentState?.currentSession] || durations.work;
    }

    const result = await chrome.storage.local.get(['settings']);
    const storedSettings = mergeSettings(result.settings);
    return storedSettings.durations[currentState?.currentSession] || storedSettings.durations.work;
  } catch (error) {
    return 25 * 60; // Default fallback
  }
}

/**
 * Handle start/pause button click
 * Syncs checkpoint with background state (Marinara Timer style)
 */
async function handleStartPause() {
  try {
    const action = currentState.isRunning && !currentState.isPaused ? 'pause' : 'start';
    const response = await chrome.runtime.sendMessage({ action });
    
    if (response && response.success && response.state) {
      const newState = response.state;
      
      // Update checkpoint based on action (Marinara Timer style)
      if (action === 'start' && newState.isRunning) {
        // Starting/resuming - set checkpoint
        checkpointStartAt = Date.now();
        checkpointElapsed = newState.initialDuration - newState.timeRemaining;
        checkpointDuration = newState.initialDuration;
      } else if (action === 'pause' && newState.isPaused) {
        // Pausing - update checkpoint elapsed and stop checkpoint
        if (checkpointStartAt) {
          checkpointElapsed += (Date.now() - checkpointStartAt) / 1000;
          checkpointStartAt = null;
        }
        // Ensure checkpoint values are set for paused state
        if (newState.initialDuration) {
          checkpointElapsed = newState.initialDuration - newState.timeRemaining;
          checkpointDuration = newState.initialDuration;
        }
      }
      
      currentState = newState;
      updateTimerDisplay();
      updateSessionInfo();
      updateButtons();
    }
  } catch (error) {
    console.error('Error handling start/pause:', error);
  }
}

/**
 * Handle reset button click
 */
async function handleReset() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'reset' });
    
    if (response && response.success && response.state) {
      // Reset checkpoint
      checkpointStartAt = null;
      checkpointElapsed = 0;
      checkpointDuration = response.state.timeRemaining;
      
      currentState = response.state;
      updateTimerDisplay();
      updateSessionInfo();
      updateButtons();
    }
  } catch (error) {
    console.error('Error handling reset:', error);
  }
}

/**
 * Handle skip button click
 */
async function handleSkip() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'skip' });
    
    if (response && response.success && response.state) {
      // Reset checkpoint for new session
      checkpointStartAt = null;
      checkpointElapsed = 0;
      checkpointDuration = response.state.timeRemaining;
      
      currentState = response.state;
      updateTimerDisplay();
      updateSessionInfo();
      updateButtons();
      
      await updateStats();
    }
  } catch (error) {
    console.error('Error handling skip:', error);
  }
}

/**
 * Toggle settings panel visibility
 */
function toggleSettings() {
  const isVisible = settingsPanel.style.display !== 'none';
  settingsPanel.style.display = isVisible ? 'none' : 'block';
  settingsToggle.querySelector('.settings-icon').textContent = isVisible ? '⚙️' : '▼';
}

function mergeSettings(savedSettings) {
  return {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    durations: {
      ...DEFAULT_SETTINGS.durations,
      ...(savedSettings?.durations || {})
    },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(savedSettings?.notifications || {})
    },
    tickingSound: {
      ...DEFAULT_SETTINGS.tickingSound,
      ...(savedSettings?.tickingSound || {})
    }
  };
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    currentSettings = mergeSettings(result.settings);

    workDurationInput.value = Math.round(currentSettings.durations.work / 60);
    shortBreakDurationInput.value = Math.round(currentSettings.durations.shortBreak / 60);
    longBreakDurationInput.value = Math.round(currentSettings.durations.longBreak / 60);
    longBreakIntervalInput.value = currentSettings.longBreakInterval;
    autoStartBreaksInput.checked = currentSettings.autoStartBreaks;
    autoStartWorkInput.checked = currentSettings.autoStartWork;
    desktopNotificationsInput.checked = currentSettings.notifications.desktop;
    soundNotificationsInput.checked = currentSettings.notifications.sound;
    soundTypeSelect.value = currentSettings.notifications.soundType;
    tickingSoundInput.checked = currentSettings.tickingSound.enabled;
    syncSoundTypeState();
  } catch (error) {
    console.error('Error loading settings:', error);
    currentSettings = mergeSettings(null);
    workDurationInput.value = 25;
    shortBreakDurationInput.value = 5;
    longBreakDurationInput.value = 15;
    longBreakIntervalInput.value = 4;
    autoStartBreaksInput.checked = false;
    autoStartWorkInput.checked = false;
    desktopNotificationsInput.checked = true;
    soundNotificationsInput.checked = true;
    soundTypeSelect.value = 'beep';
    tickingSoundInput.checked = false;
    syncSoundTypeState();
  }
}

/**
 * Handle save settings button click
 */
async function handleSaveSettings() {
  try {
    const workMinutes = parseInt(workDurationInput.value) || 25;
    const shortBreakMinutes = parseInt(shortBreakDurationInput.value) || 5;
    const longBreakMinutes = parseInt(longBreakDurationInput.value) || 15;
    const longBreakInterval = parseInt(longBreakIntervalInput.value);
    
    // Validate inputs
    if (isNaN(workMinutes) || workMinutes < 1 || workMinutes > 60) {
      showToast('Work duration must be between 1 and 60 minutes', 'error');
      return;
    }
    if (isNaN(shortBreakMinutes) || shortBreakMinutes < 1 || shortBreakMinutes > 30) {
      showToast('Short break duration must be between 1 and 30 minutes', 'error');
      return;
    }
    if (isNaN(longBreakMinutes) || longBreakMinutes < 1 || longBreakMinutes > 60) {
      showToast('Long break duration must be between 1 and 60 minutes', 'error');
      return;
    }
    if (Number.isNaN(longBreakInterval) || longBreakInterval < 0 || longBreakInterval > 12) {
      showToast('Long break interval must be between 0 and 12 sessions', 'error');
      return;
    }
    
    const settings = mergeSettings({
      durations: {
        work: workMinutes * 60,
        shortBreak: shortBreakMinutes * 60,
        longBreak: longBreakMinutes * 60
      },
      longBreakInterval,
      autoStartBreaks: autoStartBreaksInput.checked,
      autoStartWork: autoStartWorkInput.checked,
      notifications: {
        desktop: desktopNotificationsInput.checked,
        sound: soundNotificationsInput.checked,
        soundType: soundTypeSelect.value
      },
      tickingSound: {
        enabled: tickingSoundInput.checked
      }
    });
    
    // Save to storage
    await chrome.storage.local.set({ settings });
    
    // Update background worker
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'updateSettings', 
        settings
      });
      
      if (response && response.success) {
        if (response.state) {
          currentState = response.state;
        }
        if (response.settings) {
          currentSettings = mergeSettings(response.settings);
        }
      }
    } catch (err) {
      console.log('Background worker update failed, but settings are saved:', err);
    }
    
    // Close settings panel
    settingsPanel.style.display = 'none';
    settingsToggle.querySelector('.settings-icon').textContent = '⚙️';
    
    // Update UI to reflect new settings
    await updateUI();
    
    // Show success message
    showToast('Settings saved successfully!', 'success');
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Failed to save settings: ' + (error.message || 'Unknown error'), 'error');
  }
}

function playTickSound() {
  try {
    if (!tickAudioContext) {
      tickAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const now = tickAudioContext.currentTime;
    const oscillator = tickAudioContext.createOscillator();
    const gainNode = tickAudioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.value = 1200;
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(tickAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  } catch (error) {
    console.error('Error playing tick sound:', error);
  }
}

function maybePlayTickSound(remaining) {
  if (!currentSettings?.tickingSound?.enabled) {
    lastTickSecond = null;
    return;
  }

  if (!currentState?.isRunning || currentState.isPaused) {
    lastTickSecond = null;
    return;
  }

  const currentSecond = Math.floor(remaining);
  if (currentSecond !== lastTickSecond && remaining > 0) {
    lastTickSecond = currentSecond;
    playTickSound();
  }
}

/**
 * Start UI update interval - pure setInterval countdown (Marinara Timer style)
 * Only calculates and displays, no background syncing during countdown
 */
function startUIUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  updateInterval = setInterval(() => {
    if (!currentState) return;
    
    const remaining = getRemainingSeconds();

    // Simply update display using checkpoint calculation
    updateTimerDisplay();
    maybePlayTickSound(remaining);
    
    // Check if timer completed (only if running)
    if (currentState.isRunning && !currentState.isPaused && checkpointStartAt) {
      if (remaining <= 0) {
        // Timer completed, sync with background to handle completion
        updateUI();
      }
    }
  }, 1000);
}

/**
 * Clean up on popup close
 */
window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
