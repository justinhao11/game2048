# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 2048 puzzle game built with Next.js 15, React 18, TypeScript, and Tailwind CSS. It's a single-page application featuring the classic 2048 gameplay with powerup mechanics (undo, swap, delete) and an interactive tutorial system.

## Development Commands

### Core Commands
```bash
npm run dev        # Start development server on 0.0.0.0:3000 with Turbopack
npm run build      # Build production bundle
npm start          # Start production server
npm run lint       # Run Biome linter and TypeScript type checking
npm run format     # Format code with Biome
```

### Code Quality
- **Linting**: Uses Biome (not ESLint) with accessibility rules mostly disabled
- **Type Checking**: TypeScript in strict mode - `npx tsc --noEmit` for type-only checks
- **Formatting**: Biome with double quotes, space indentation
- **Scope**: Biome only processes files in `src/**/*.ts` and `src/**/*.tsx` (see biome.json)

## Architecture

### App Structure (Next.js App Router)
- **src/app/layout.tsx**: Root layout with font configuration and metadata
- **src/app/ClientBody.tsx**: Client component that handles hydration-related class cleanup
- **src/app/page.tsx**: Homepage that renders the Game2048 component
- **src/components/Game2048.tsx**: Main game component (885 lines, all game logic)

### Game State Management
The game uses React hooks for state management, with no external state library:

**Core State:**
- `board: GameBoard` - 4x4 grid of numbers or nulls
- `score: number` - Current game score
- `bestScore: number` - Persisted in localStorage
- `gameWon/gameOver: boolean` - Game status flags

**Powerup State:**
- `powerupMode: 'none' | 'swap' | 'delete'` - Active powerup mode
- `selectedTiles: [number, number][]` - Tiles selected for swap
- `undoStack: GameState[]` - History for undo (max 5 states)
- `undoCount/swapCount/deleteCount: number` - Powerup usage counts

**Tutorial State:**
- `showTutorial/showWelcome: boolean` - Tutorial flow control
- `tutorialStep: number` - Current tutorial step (0-5)
- `hasSeenTutorial: boolean` - Persisted in localStorage

### Game Logic Flow (src/components/Game2048.tsx)
1. **Movement**: `handleKeyPress` → `processMove` → `moveBoard` → `moveLine`
   - Supports arrow keys and WASD
   - Prevents moves during animations via `isProcessingMove` flag
   - Each move: merges tiles, adds random tile, checks win/loss, unlocks powerups

2. **Powerup Mechanics**:
   - **Undo**: Restores previous state from `undoStack`
   - **Swap**: Two-click selection system, swaps tile positions
   - **Delete**: Removes all tiles matching the clicked number
   - Unlocks: Earn powerups by scoring high on single merges (128+, 256+, 512+)

3. **Persistence**: Uses `safeLocalStorage` wrapper to handle localStorage unavailability
   - Saves: `2048-best-score`, `2048-tutorial-seen`

### Key Constants (Game2048.tsx)
- `GRID_SIZE = 4`
- `WINNING_NUMBER = 2048`
- `UNDO_UNLOCK_THRESHOLD = 128`
- `SWAP_UNLOCK_THRESHOLD = 256`
- `DELETE_UNLOCK_THRESHOLD = 512`
- `MAX_UNDO_COUNT = 3`, `MAX_SWAP_COUNT = 2`, `MAX_DELETE_COUNT = 1`

## Styling

### Tailwind Configuration
- Custom colors for 2048 tiles (matching original game design)
- Responsive design with mobile support
- Uses `tailwind-merge` via `cn()` utility for conditional classes
- Board fixed at 420px max width, responsive down to 90vw

### Tile Colors
Defined in `getTileColor()` function (src/components/Game2048.tsx:236):
- Each tile value (2, 4, 8, 16, etc.) has a specific color scheme
- Text color switches from dark to white at value 8
- Progressive shadow intensity with higher values

## Path Aliases
- `@/*` maps to `src/*` (configured in tsconfig.json)

## TypeScript Configuration
- Strict mode enabled
- Target: ES2017
- Module resolution: bundler (Next.js 15)
- No emit (Next.js handles compilation)

## Common Pitfalls

1. **Biome Scope**: Only `src/**/*.ts` and `src/**/*.tsx` files are linted/formatted. Config files outside src/ won't be processed.

2. **Client Components**: Game2048 is a client component (`'use client'`). Avoid adding server-side logic to this file.

3. **Animation Timing**: The `isProcessingMove` flag prevents input during tile animations (150ms). Don't reduce this without adjusting transition durations.

4. **LocalStorage**: Always use `safeLocalStorage` wrapper to avoid SSR/hydration issues.

5. **Undo Stack**: Limited to last 5 states to prevent memory issues. Consider this when modifying undo logic.
