# Tickly - Minimalist Pomodoro Timer & Focus Tool

Boost productivity with a clean, modern Pomodoro timer. Features dark mode, smart notifications, and session tracking to keep you focused.

## Features

### Core Functionality

- **25-minute work sessions** - Standard Pomodoro technique
- **5-minute short breaks** - Quick rest between work sessions
- **15-minute long breaks** - Extended break after every 4 cycles
- **Full timer controls** - Start, pause, reset, and skip sessions
- **Persistent state** - Timer continues running even when popup is closed

### User Interface

- **Clean, modern design** - Responsive UI with smooth animations
- **Dark/Light theme toggle** - Choose your preferred theme
- **Real-time timer display** - Large, easy-to-read countdown
- **Session indicators** - Clear display of current session type and cycle
- **Badge counter** - Extension icon shows remaining minutes

### Advanced Features

- **Desktop notifications** - Alerts when sessions complete
- **Sound notifications** - Audio feedback for session completion
- **Session history** - Track completed Pomodoros for today
- **Accurate timing** - No drift, handles browser idle gracefully
- **State persistence** - All settings and progress saved locally

## Installation

### From Source (Developer Mode)

1. **Download or clone this repository**

   ```bash
   git clone <repository-url>
   cd "Tickly"
   ```

2. **Open Chrome Extensions page**

   - Navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**

   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**

   - Click "Load unpacked"
   - Select the extension directory (`Tickly`)

5. **Grant permissions**
   - The extension will request notification permissions on first use
   - Click "Allow" when prompted

### Icon Setup

The extension requires icon files. You have two options:

**Option 1: Create your own icons**

- Create icon files in the `icons/` directory:
  - `icon16.png` (16x16 pixels)
  - `icon32.png` (32x32 pixels)
  - `icon48.png` (48x48 pixels)
  - `icon128.png` (128x128 pixels)
- Use a tomato emoji (🍅) or Pomodoro-themed design

**Option 2: Use placeholder icons**

- You can use any PNG images temporarily for testing
- Recommended: Create simple colored squares with "P" or tomato emoji

## Usage

### Basic Operation

1. **Open the extension**

   - Click the extension icon in the Chrome toolbar
   - The popup will display the current timer state

2. **Start a work session**

   - Click the "Start" button
   - The timer will count down from 25:00
   - The badge on the extension icon shows remaining minutes

3. **Pause/Resume**

   - Click "Pause" to pause the timer
   - Click "Resume" to continue from where you left off

4. **Reset**

   - Click "Reset" to return to the initial state
   - Confirmation dialog will appear

5. **Skip session**
   - Click "Skip" to immediately move to the next session
   - Useful if you need to adjust your schedule

### Session Flow

- **Work Session (25 min)** → **Short Break (5 min)** → **Work Session** → **Short Break** → ...
- After 4 work sessions, you get a **Long Break (15 min)**
- The cycle counter shows your progress (e.g., "Cycle 2/4")

### Theme Toggle

- Click the moon/sun icon in the header to switch between dark and light themes
- Your preference is saved automatically

### Notifications

- Desktop notifications appear when a session completes
- Make sure notifications are enabled in Chrome settings
- The extension will request permission on first use

## File Structure

```
Tickly/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker (timer logic, state management)
├── popup.html             # Popup UI structure
├── popup.css              # Popup styles and themes
├── popup.js               # Popup UI logic and interactions
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## Technical Details

### Architecture

- **Manifest V3** - Uses the latest Chrome extension standard
- **Service Worker** - Background script handles timer logic
- **Message Passing** - Communication between popup and background
- **Chrome Storage API** - Persistent state management
- **Chrome Notifications API** - Desktop notifications
- **Chrome Alarms API** - Backup timer mechanism

### Timer Accuracy

The timer uses a combination of:

- `Date.now()` for precise timestamp tracking
- Interval-based updates (1 second)
- State persistence to handle browser restarts
- Pause time tracking to maintain accuracy

### State Management

All timer state is stored in `chrome.storage.local`:

- Current session type and time remaining
- Running/paused status
- Cycle count
- Session history
- Theme preference

## Development

### Testing

1. **Load unpacked extension** (see Installation)
2. **Test all features**:

   - Start/pause/reset/skip
   - Close and reopen popup (state should persist)
   - Let timer complete (check notifications)
   - Test theme toggle
   - Verify badge updates

3. **Check console for errors**:
   - Open popup → Right-click → Inspect
   - Check background worker: Extensions page → Service Worker link

### Debugging

- **Popup debugging**: Right-click popup → Inspect
- **Background worker**: `chrome://extensions/` → Find extension → "Service Worker" link
- **Storage inspection**: DevTools → Application → Storage → Local Storage

## Browser Compatibility

- **Chrome**: 88+ (Manifest V3 support)
- **Edge**: 88+ (Chromium-based)
- **Opera**: 74+ (Chromium-based)
- **Brave**: Latest (Chromium-based)

## License

This project is open source and available for personal and commercial use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions:

- Open an issue on the repository
- Check existing issues for solutions

## Changelog

### Version 1.0.0

- Initial release
- Core Pomodoro functionality
- Dark/light theme support
- Desktop notifications
- Session history tracking
- Persistent state management
- Configurable long break intervals
- Auto-start functionality
- Enhanced statistics (today, week, month, all-time)
- Sound notification options
- Ticking sound support

---

**Enjoy your focused work sessions! 🍅**
