# Pickleboard 🏓

**Pickleboard** is an interactive pickleball court planner that allows you to visualize player positions and ball placement on a regulation-sized pickleball court with expanded planning area. Perfect for coaches, players, and anyone who wants to plan strategies or understand court positioning.

## Quick Start

1. **Clone or download** the project files to your local machine
2. **Open `index.html`** in any modern web browser
3. **Start planning!** Drag the player dots and ball around the court

### Live Demo
Simply open `index.html` in your browser - no build process or server required!

## Features

### 🏐 Interactive Court
- **Regulation pickleball court** with accurate proportions (44' × 20')
- **SVG-based rendering** for crisp, scalable graphics
- **Responsive design** that works on desktop and mobile

### 🎯 Draggable Tokens
- **4 player dots** (red circles) for positioning players
- **1 ball token** (orange circle) for ball placement
- **Smooth drag interaction** with mouse or touch
- **Extended movement area** - tokens can move outside court boundaries for strategic planning

### ⚙️ Game Modes
- **Singles mode** - Shows 2 players positioned for singles play
- **Doubles mode** - Shows all 4 players positioned for doubles play
- **Automatic repositioning** when switching modes

### 🎨 Customization
- **Light/Dark theme toggle** - Switch between themes
- **Theme persistence** - Your preference is saved
- **Reset button** - Return tokens to default positions

### 📱 Cross-Platform
- **Desktop browsers** - Chrome, Safari, Firefox, Edge
- **Mobile browsers** - iOS Safari, Android Chrome
- **Touch support** - Native mobile interaction
- **Responsive layout** - Adapts to screen size

## Overview

Pickleboard uses modern web technologies to create a smooth, interactive experience:

- **HTML5** for semantic structure
- **CSS3** with CSS Variables for theming and responsive design
- **Vanilla JavaScript** with ES6+ features for all interactions
- **SVG** for scalable, crisp court graphics

The app follows a component-based architecture with a single `Pickleboard` class managing all state and interactions. No external dependencies or build tools are required.

## Data Model

### Token Structure
```javascript
{
  id: 'player1',        // Unique identifier
  type: 'player',       // 'player' or 'ball'
  element: <SVGElement>, // DOM reference
  x: 140,               // SVG x coordinate
  y: 120                // SVG y coordinate
}
```

### Court Boundaries
```javascript
{
  left: 40,    // Left boundary (SVG units)
  right: 840,  // Right boundary
  top: 40,     // Top boundary
  bottom: 400  // Bottom boundary
}
```

### Game Mode Positions
```javascript
positions: {
  singles: {
    player1: { cx: 240, cy: 120 }, // Back court, left side
    player2: { cx: 640, cy: 320 }, // Front court, right side
    // ... players 3&4 hidden in singles
    ball: { cx: 440, cy: 220 }     // Center court
  },
  doubles: {
    player1: { cx: 140, cy: 120 }, // Back left
    player2: { cx: 740, cy: 120 }, // Back right
    player3: { cx: 140, cy: 320 }, // Front left
    player4: { cx: 740, cy: 320 }, // Front right
    ball: { cx: 440, cy: 220 }     // Center
  }
}
```

## Court Layout

The court is rendered as an SVG with distinct color-coded zones:

- **Dark green background** - Outside court planning area
- **Medium green** - Playing surface (regulation court)
- **Purple highlighting** - Service boxes
- **Blue highlighting** - Non-volley zone (kitchen)  
- **White lines** - Court boundaries and service lines
- **Dark line** - Net across the center
- **Regulation proportions** - 44' × 20' court with expanded planning area

### Court Zones
- **Outside area** - Extended planning space around the court
- **Service boxes** - Four service areas highlighted in purple
- **Non-volley zone** - 7-foot kitchen areas on each side of net (blue)
- **Baselines** - Back boundaries of the court
- **Sidelines** - Side boundaries of the court

## API

The app exposes a global `pickleboard` object with these methods:

```javascript
// Get current token positions
window.pickleboard.getTokenPositions()
// Returns: { player1: {x: 140, y: 120}, ... }

// Set a specific token position
window.pickleboard.setTokenPosition('player1', 200, 150)

// Reset all positions to current game mode defaults
window.pickleboard.resetPositions()

// Switch game mode programmatically
window.pickleboard.setGameMode('doubles')
```

## Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ | ✅ |
| Safari | ✅ | ✅ |
| Firefox | ✅ | ✅ |
| Edge | ✅ | ✅ |

**Minimum Requirements:**
- ES6 support (Arrow functions, Classes, const/let)
- SVG support
- CSS Variables support
- Touch events (mobile)

## File Structure

```
pickleboard/
├── index.html      # Main HTML structure
├── styles.css      # All styling and responsive design
├── script.js       # Interactive functionality
└── README.md       # This documentation
```

## Contributing

This is a single-file web app designed to be simple and self-contained. To modify:

1. **HTML changes** - Edit `index.html` for structure
2. **Styling changes** - Edit `styles.css` for appearance
3. **Functionality changes** - Edit `script.js` for behavior

The code is well-commented and follows modern JavaScript practices.

## License

Open source - feel free to use, modify, and distribute.

---

**Built with ❤️ for the pickleball community**
