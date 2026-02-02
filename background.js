/**
 * Background Service Worker for Pomodoro Timer Extension
 * Handles timer logic, state persistence, notifications, and badge updates
 */

// Default settings
const DEFAULT_SETTINGS = {
  durations: {
    work: 25 * 60, // 25 minutes
    shortBreak: 5 * 60, // 5 minutes
    longBreak: 15 * 60 // 15 minutes
  },
  longBreakInterval: 4, // Number of work sessions before long break (0 = disabled)
  autoStartBreaks: false,
  autoStartWork: false,
  notifications: {
    desktop: true,
    sound: true,
    soundType: 'beep' // beep | chime | bell
  },
  tickingSound: {
    enabled: false
  }
};

// Session types
const SESSION_TYPES = {
  WORK: 'work',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak'
};

// Settings (loaded from storage)
let settings = { ...DEFAULT_SETTINGS, durations: { ...DEFAULT_SETTINGS.durations } };

// Timer state
let timerState = {
  isRunning: false,
  isPaused: false,
  currentSession: SESSION_TYPES.WORK,
  timeRemaining: DEFAULT_SETTINGS.durations.work,
  cycleCount: 0,
  startTime: null,
  pausedAt: null,
  totalPausedTime: 0,
  initialDuration: DEFAULT_SETTINGS.durations.work // Duration when timer started (for accurate calculation)
};

/**
 * Merge settings with defaults and legacy durations.
 */
function mergeSettings(savedSettings, legacyDurations) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    durations: {
      ...DEFAULT_SETTINGS.durations,
      ...(savedSettings && savedSettings.durations ? savedSettings.durations : {})
    },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(savedSettings && savedSettings.notifications ? savedSettings.notifications : {})
    },
    tickingSound: {
      ...DEFAULT_SETTINGS.tickingSound,
      ...(savedSettings && savedSettings.tickingSound ? savedSettings.tickingSound : {})
    }
  };

  if (legacyDurations) {
    merged.durations = {
      ...merged.durations,
      ...legacyDurations
    };
  }

  return sanitizeSettings(merged);
}

function sanitizeNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  if (Number.isFinite(min) && number < min) {
    return fallback;
  }
  if (Number.isFinite(max) && number > max) {
    return fallback;
  }
  return number;
}

function sanitizeSettings(rawSettings) {
  const safe = {
    durations: {
      work: sanitizeNumber(rawSettings.durations?.work, DEFAULT_SETTINGS.durations.work, 60, 60 * 60),
      shortBreak: sanitizeNumber(rawSettings.durations?.shortBreak, DEFAULT_SETTINGS.durations.shortBreak, 60, 30 * 60),
      longBreak: sanitizeNumber(rawSettings.durations?.longBreak, DEFAULT_SETTINGS.durations.longBreak, 60, 60 * 60)
    },
    longBreakInterval: Math.floor(
      sanitizeNumber(rawSettings.longBreakInterval, DEFAULT_SETTINGS.longBreakInterval, 0, 12)
    ),
    autoStartBreaks: Boolean(rawSettings.autoStartBreaks),
    autoStartWork: Boolean(rawSettings.autoStartWork),
    notifications: {
      desktop: rawSettings.notifications?.desktop !== false,
      sound: rawSettings.notifications?.sound !== false,
      soundType: ['beep', 'chime', 'bell'].includes(rawSettings.notifications?.soundType)
        ? rawSettings.notifications.soundType
        : DEFAULT_SETTINGS.notifications.soundType
    },
    tickingSound: {
      enabled: Boolean(rawSettings.tickingSound?.enabled)
    }
  };

  return safe;
}

/**
 * Load settings from storage, with legacy migration for durations.
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['settings', 'durations']);
    settings = mergeSettings(result.settings, result.durations);
    await chrome.storage.local.set({ settings, durations: settings.durations });
  } catch (error) {
    console.error('Error loading settings:', error);
    settings = { ...DEFAULT_SETTINGS, durations: { ...DEFAULT_SETTINGS.durations } };
  }
}

/**
 * Get duration for a specific session type
 */
async function getSessionDuration(sessionType) {
  const durations = settings.durations;
  switch (sessionType) {
    case SESSION_TYPES.WORK:
      return durations.work;
    case SESSION_TYPES.SHORT_BREAK:
      return durations.shortBreak;
    case SESSION_TYPES.LONG_BREAK:
      return durations.longBreak;
    default:
      return durations.work;
  }
}

/**
 * Initialize extension - load saved state and set up listeners
 */
chrome.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  await loadState();
  updateBadge();
});

/**
 * Load timer state from storage
 */
async function loadState() {
  try {
    await loadSettings();
    const result = await chrome.storage.local.get(['timerState']);
    if (result.timerState) {
      timerState = result.timerState;
      
      // Recalculate time remaining if timer was running
      if (timerState.isRunning && !timerState.isPaused && timerState.startTime) {
        const initialDuration = Number.isFinite(timerState.initialDuration)
          ? timerState.initialDuration
          : Number.isFinite(timerState.timeRemaining)
            ? timerState.timeRemaining
            : await getSessionDuration(timerState.currentSession);
        timerState.initialDuration = initialDuration;

        const elapsedMs = Date.now() - timerState.startTime - (timerState.totalPausedTime || 0);
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        timerState.timeRemaining = Math.max(0, initialDuration - elapsedSeconds);
        
        // If timer expired while extension was closed, handle completion
        if (timerState.timeRemaining <= 0) {
          await handleTimerComplete();
        }
      } else if (!timerState.isRunning && !timerState.isPaused) {
        // If timer is not running, ensure timeRemaining matches current session duration
        const expectedDuration = await getSessionDuration(timerState.currentSession);
        if (timerState.timeRemaining !== expectedDuration) {
          timerState.timeRemaining = expectedDuration;
          timerState.initialDuration = expectedDuration;
          await saveState();
        }
      }
    } else {
        // Initialize with default work duration
        timerState.currentSession = SESSION_TYPES.WORK;
        timerState.timeRemaining = await getSessionDuration(SESSION_TYPES.WORK);
        timerState.initialDuration = timerState.timeRemaining;
        await saveState();
      }
  } catch (error) {
    console.error('Error loading state:', error);
  }
}

/**
 * Save timer state to storage
 */
async function saveState() {
  try {
    await chrome.storage.local.set({ timerState });
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

/**
 * Update badge with remaining time
 */
function updateBadge() {
  const minutes = Math.ceil(timerState.timeRemaining / 60);
  const displayText = minutes > 0 ? minutes.toString() : '';
  
  chrome.action.setBadgeText({ text: displayText });
  chrome.action.setBadgeBackgroundColor({ color: timerState.currentSession === SESSION_TYPES.WORK ? '#d32f2f' : '#388e3c' });
}

/**
 * Start the timer
 */
async function startTimer() {
  if (timerState.isRunning && !timerState.isPaused) {
    return; // Already running
  }

  if (timerState.isPaused) {
    // Resume from pause
    timerState.totalPausedTime += Date.now() - timerState.pausedAt;
    timerState.isPaused = false;
    timerState.pausedAt = null;
  } else {
    // Start fresh
    await loadSettings();
    const sessionDuration = await getSessionDuration(timerState.currentSession);
    timerState.isRunning = true;
    timerState.startTime = Date.now();
    timerState.totalPausedTime = 0;
    timerState.timeRemaining = sessionDuration;
    timerState.initialDuration = sessionDuration; // Store initial duration
  }

  await saveState();
  updateBadge();
  await scheduleEndAlarm();
  startTick();
}

/**
 * Pause the timer
 */
async function pauseTimer() {
  if (!timerState.isRunning || timerState.isPaused) {
    return;
  }

  // Calculate current timeRemaining before pausing
  if (timerState.startTime && timerState.initialDuration) {
    const now = Date.now();
    const elapsedMs = now - timerState.startTime - timerState.totalPausedTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    timerState.timeRemaining = Math.max(0, timerState.initialDuration - elapsedSeconds);
  }

  timerState.isPaused = true;
  timerState.pausedAt = Date.now();
  
  // Stop tick interval
  if (timerState.tickInterval) {
    clearInterval(timerState.tickInterval);
    timerState.tickInterval = null;
  }
  await clearEndAlarm();
  
  await saveState();
  updateBadge();
}

/**
 * Reset the timer to initial state
 */
async function resetTimer() {
  // Ensure durations are loaded before resetting
  await loadSettings();
  
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.startTime = null;
  timerState.pausedAt = null;
  timerState.totalPausedTime = 0;
  timerState.cycleCount = 0;
  
  // Reset to work session with full duration (using custom or default)
  timerState.currentSession = SESSION_TYPES.WORK;
  timerState.timeRemaining = await getSessionDuration(SESSION_TYPES.WORK);
  timerState.initialDuration = timerState.timeRemaining;
  
  await saveState();
  await clearEndAlarm();
  updateBadge();
}

/**
 * Skip current session and move to next
 */
async function skipSession() {
  await handleTimerComplete();
}

/**
 * Handle timer completion
 */
async function handleTimerComplete() {
  // Play notification sound
  if (settings.notifications.sound) {
    playNotificationSound(settings.notifications.soundType);
  }
  
  // Show desktop notification
  if (settings.notifications.desktop) {
    await showNotification();
  }
  
  // Update session history if work session completed
  if (timerState.currentSession === SESSION_TYPES.WORK) {
    await updateSessionHistory();
    timerState.cycleCount++;
  }
  
  // Move to next session
  if (timerState.currentSession === SESSION_TYPES.WORK) {
    // After work, decide between short or long break
    if (settings.longBreakInterval > 0 && timerState.cycleCount % settings.longBreakInterval === 0) {
      timerState.currentSession = SESSION_TYPES.LONG_BREAK;
      timerState.timeRemaining = await getSessionDuration(SESSION_TYPES.LONG_BREAK);
    } else {
      timerState.currentSession = SESSION_TYPES.SHORT_BREAK;
      timerState.timeRemaining = await getSessionDuration(SESSION_TYPES.SHORT_BREAK);
    }
  } else {
    // After break, go to work
    timerState.currentSession = SESSION_TYPES.WORK;
    timerState.timeRemaining = await getSessionDuration(SESSION_TYPES.WORK);
  }
  
  // Reset timer state (autostart if enabled)
  timerState.isPaused = false;
  timerState.totalPausedTime = 0;
  timerState.pausedAt = null;
  timerState.initialDuration = timerState.timeRemaining;
  timerState.startTime = null;

  const shouldAutostart = timerState.currentSession === SESSION_TYPES.WORK
    ? settings.autoStartWork
    : settings.autoStartBreaks;

  timerState.isRunning = shouldAutostart;
  if (shouldAutostart) {
    timerState.startTime = Date.now();
    await scheduleEndAlarm();
    startTick();
  } else {
    await clearEndAlarm();
  }
  
  await saveState();
  updateBadge();
}

/**
 * Timer tick - updates every second
 * Uses initialDuration and elapsed time for accurate calculation (zero drift)
 */
function startTick() {
  // Clear any existing interval
  if (timerState.tickInterval) {
    clearInterval(timerState.tickInterval);
  }
  
  timerState.tickInterval = setInterval(async () => {
    if (!timerState.isRunning || timerState.isPaused) {
      clearInterval(timerState.tickInterval);
      timerState.tickInterval = null;
      return;
    }
    
    // Calculate elapsed time in seconds (excluding paused time)
    const now = Date.now();
    const elapsedMs = now - timerState.startTime - timerState.totalPausedTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    // Calculate remaining from initial duration (prevents drift)
    const calculatedRemaining = Math.max(0, timerState.initialDuration - elapsedSeconds);
    
    // Only update if changed to prevent jitter
    if (timerState.timeRemaining !== calculatedRemaining) {
      timerState.timeRemaining = calculatedRemaining;
      updateBadge();
      
      // Check if timer completed
      if (timerState.timeRemaining <= 0) {
        clearInterval(timerState.tickInterval);
        timerState.tickInterval = null;
        await handleTimerComplete();
      } else {
        await saveState();
      }
    } else {
      // Still update badge even if timeRemaining hasn't changed
      updateBadge();
    }
  }, 1000);
}

/**
 * Play notification sound
 * Uses programmatic content script injection to play sound in active tabs
 * Falls back to notification's built-in sound if no active tab
 */
async function playNotificationSound(soundType = 'beep') {
  try {
    // Try to play sound in an active tab using programmatic injection
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs.length > 0 && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
      try {
        // Inject a function programmatically - it will play sound immediately
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          args: [soundType],
          func: (type) => {
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const gainNode = audioContext.createGain();
              gainNode.connect(audioContext.destination);

              const playTone = (frequency, start, duration) => {
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.value = frequency;
                oscillator.connect(gainNode);
                oscillator.start(start);
                oscillator.stop(start + duration);
              };

              const now = audioContext.currentTime;
              gainNode.gain.setValueAtTime(0.25, now);
              gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

              if (type === 'chime') {
                playTone(880, now, 0.18);
                playTone(1320, now + 0.2, 0.2);
              } else if (type === 'bell') {
                playTone(660, now, 0.3);
                playTone(990, now + 0.05, 0.25);
              } else {
                playTone(800, now, 0.4);
              }
            } catch (error) {
              console.error('Error playing sound:', error);
            }
          }
        });
      } catch (error) {
        // Injection failed (e.g., restricted page), notification sound will still play
        console.log('Sound injection failed, using notification sound');
      }
    }
  } catch (error) {
    // Fallback: notification will play its default sound
    console.log('Using notification default sound');
  }
}

/**
 * Show desktop notification
 */
async function showNotification() {
  const sessionName = timerState.currentSession === SESSION_TYPES.WORK 
    ? 'Work Session' 
    : timerState.currentSession === SESSION_TYPES.LONG_BREAK
    ? 'Long Break'
    : 'Short Break';
  
  const message = timerState.currentSession === SESSION_TYPES.WORK
    ? 'Time for a break! 🎉'
    : 'Break time is over. Let\'s get back to work! 💪';
  
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: `${sessionName} Complete!`,
      message: message
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

/**
 * Update session history
 */
async function updateSessionHistory() {
  try {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['sessionHistory']);
    const history = result.sessionHistory || {};
    
    if (!history[today]) {
      history[today] = 0;
    }
    history[today]++;
    
    await chrome.storage.local.set({ sessionHistory: history });
  } catch (error) {
    console.error('Error updating session history:', error);
  }
}

/**
 * Get session history for today
 */
async function getTodaySessionCount() {
  try {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['sessionHistory']);
    const history = result.sessionHistory || {};
    return history[today] || 0;
  } catch (error) {
    console.error('Error getting session history:', error);
    return 0;
  }
}

/**
 * Get session statistics summary.
 */
async function getSessionStats() {
  try {
    const result = await chrome.storage.local.get(['sessionHistory']);
    const history = result.sessionHistory || {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const monthStart = new Date(today);
    monthStart.setDate(1);

    let total = 0;
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    Object.entries(history).forEach(([key, count]) => {
      const date = new Date(key);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      total += count;
      if (date >= today) {
        todayCount += count;
      }
      if (date >= weekStart) {
        weekCount += count;
      }
      if (date >= monthStart) {
        monthCount += count;
      }
    });

    return {
      today: todayCount,
      week: weekCount,
      month: monthCount,
      total
    };
  } catch (error) {
    console.error('Error getting session stats:', error);
    return {
      today: 0,
      week: 0,
      month: 0,
      total: 0
    };
  }
}

/**
 * Handle messages from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'start':
          await startTimer();
          sendResponse({ success: true, state: timerState });
          break;
        case 'pause':
          await pauseTimer();
          sendResponse({ success: true, state: timerState });
          break;
        case 'reset':
          await resetTimer();
          sendResponse({ success: true, state: timerState });
          break;
        case 'skip':
          await skipSession();
          sendResponse({ success: true, state: timerState });
          break;
        case 'getState':
          await loadState();
          
          // Only recalculate if timer is running and tick interval isn't running
          // (tick interval already updates timeRemaining, so we don't need to recalculate here)
          if (timerState.isRunning && !timerState.isPaused && timerState.startTime && timerState.initialDuration) {
            // Only recalculate if tick interval isn't active (shouldn't happen, but safety check)
            if (!timerState.tickInterval) {
              const now = Date.now();
              const elapsedMs = now - timerState.startTime - timerState.totalPausedTime;
              const elapsedSeconds = Math.floor(elapsedMs / 1000);
              timerState.timeRemaining = Math.max(0, timerState.initialDuration - elapsedSeconds);
              
              if (timerState.timeRemaining <= 0) {
                await handleTimerComplete();
              }
            }
            // Update badge
            updateBadge();
          } else if (!timerState.isRunning && !timerState.isPaused) {
            // Timer is idle - ensure timeRemaining matches current session duration
            const expectedDuration = await getSessionDuration(timerState.currentSession);
            if (timerState.timeRemaining !== expectedDuration) {
              timerState.timeRemaining = expectedDuration;
              timerState.initialDuration = expectedDuration;
              await saveState();
              updateBadge();
            }
          }
          
          // Return a copy of state (popup should never mutate it)
          sendResponse({ 
            success: true, 
            state: {
              isRunning: timerState.isRunning,
              isPaused: timerState.isPaused,
              currentSession: timerState.currentSession,
              timeRemaining: timerState.timeRemaining,
              cycleCount: timerState.cycleCount,
              startTime: timerState.startTime,
              initialDuration: timerState.initialDuration,
              pausedAt: timerState.pausedAt,
              totalPausedTime: timerState.totalPausedTime
            }
          });
          break;
        case 'getTodayCount': {
          const count = await getTodaySessionCount();
          sendResponse({ success: true, count });
          break;
        }
        case 'getStats': {
          const stats = await getSessionStats();
          sendResponse({ success: true, stats });
          break;
        }
        case 'ping':
          sendResponse({ success: true, message: 'pong' });
          break;
        case 'updateSettings':
          try {
            settings = mergeSettings(request.settings, request.settings?.durations);
            await chrome.storage.local.set({ settings, durations: settings.durations });

            // Always update current session duration if timer is not running
            if (!timerState.isRunning && !timerState.isPaused) {
              timerState.timeRemaining = await getSessionDuration(timerState.currentSession);
              timerState.initialDuration = timerState.timeRemaining;
              await saveState();
              updateBadge();
            }

            sendResponse({ success: true, state: timerState, settings });
          } catch (error) {
            console.error('Background: Error updating settings:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
        case 'updateDurations':
          try {
            settings = mergeSettings({ ...settings, durations: request.durations }, request.durations);
            await chrome.storage.local.set({ settings, durations: settings.durations });

            // Always update current session duration if timer is not running
            if (!timerState.isRunning && !timerState.isPaused) {
              timerState.timeRemaining = await getSessionDuration(timerState.currentSession);
              timerState.initialDuration = timerState.timeRemaining;
              await saveState();
              updateBadge();
            }

            sendResponse({ success: true, state: timerState, settings });
          } catch (error) {
            console.error('Background: Error updating durations:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', request.action, error);
      sendResponse({ success: false, error: error.message || 'Unknown error' });
    }
  })();
  return true; // Keep message channel open for async response
});

/**
 * Handle alarm events (fallback for timer)
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoro-end') {
    handleTimerComplete();
  }
});

async function scheduleEndAlarm() {
  if (!timerState.isRunning || timerState.isPaused || !timerState.startTime) {
    return;
  }
  const remainingMs = Math.max(timerState.timeRemaining, 1) * 1000;
  await chrome.alarms.create('pomodoro-end', { when: Date.now() + remainingMs });
}

async function clearEndAlarm() {
  await chrome.alarms.clear('pomodoro-end');
}

