'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type GameBoard = (number | null)[][]
type GameState = {
  board: GameBoard
  score: number
}
type PowerupMode = 'none' | 'swap' | 'delete'
type TutorialStep = {
  title: string
  description: string
  highlight?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const GRID_SIZE = 4
const WINNING_NUMBER = 2048

// Powerup unlock thresholds
const UNDO_UNLOCK_THRESHOLD = 128
const SWAP_UNLOCK_THRESHOLD = 256
const DELETE_UNLOCK_THRESHOLD = 512
const MAX_UNDO_COUNT = 3
const MAX_SWAP_COUNT = 2
const MAX_DELETE_COUNT = 1

// Tutorial steps
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to 2048!",
    description: "This is a number puzzle game. Your goal is to merge matching number tiles until you reach 2048!"
  },
  {
    title: "How to Move",
    description: "Use arrow keys or WASD keys to move tiles. All tiles will slide in the same direction.",
    highlight: "game-board"
  },
  {
    title: "Merging Tiles",
    description: "When two tiles with the same number touch, they merge into one bigger number! For example: 2+2=4, 4+4=8."
  },
  {
    title: "Scoring System",
    description: "Every time you merge tiles, you earn points. The score equals the value of the merged tile.",
    highlight: "score-section"
  },
  {
    title: "Powerup Features",
    description: "You have special powerups to help: undo last move, swap two tiles, delete tiles by number.",
    highlight: "powerups-section"
  },
  {
    title: "Start Playing!",
    description: "Now you know all the basics. Try moving tiles and aim to reach 2048! Good luck!"
  }
]

// Compare two arrays for equality
const arraysEqual = (arr1: (number | null)[], arr2: (number | null)[]): boolean => {
  return arr1.length === arr2.length && arr1.every((val, idx) => val === arr2[idx])
}

// Safe localStorage wrapper
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }
}

// Initialize empty 4x4 board
const initializeBoard = (): GameBoard => {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
}

// Add random tile (2 or 4) to empty cell
const addRandomTile = (board: GameBoard): GameBoard => {
  const emptyCells: [number, number][] = []

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === null) {
        emptyCells.push([row, col])
      }
    }
  }

  if (emptyCells.length === 0) return board

  const newBoard = board.map(row => [...row])
  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)]
  const randomValue = Math.random() < 0.9 ? 2 : 4

  newBoard[randomCell[0]][randomCell[1]] = randomValue
  return newBoard
}

// Move and merge tiles in a line (array)
const moveLine = (line: (number | null)[]): { newLine: (number | null)[], score: number } => {
  // Filter out nulls and move all numbers to the left
  const filteredLine = line.filter(cell => cell !== null) as number[]
  const newLine: (number | null)[] = []
  let score = 0
  let i = 0

  while (i < filteredLine.length) {
    if (i < filteredLine.length - 1 && filteredLine[i] === filteredLine[i + 1]) {
      // Merge tiles
      const mergedValue = filteredLine[i] * 2
      newLine.push(mergedValue)
      score += mergedValue
      i += 2 // Skip next tile as it's been merged
    } else {
      newLine.push(filteredLine[i])
      i++
    }
  }

  // Fill the rest with nulls
  while (newLine.length < GRID_SIZE) {
    newLine.push(null)
  }

  return { newLine, score }
}

// Move board in specified direction
const moveBoard = (board: GameBoard, direction: 'up' | 'down' | 'left' | 'right'): { newBoard: GameBoard, score: number, moved: boolean } => {
  const newBoard: GameBoard = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
  let totalScore = 0
  let moved = false

  if (direction === 'left') {
    for (let row = 0; row < GRID_SIZE; row++) {
      const { newLine, score } = moveLine(board[row])
      newBoard[row] = newLine
      totalScore += score
      if (!arraysEqual(newLine, board[row])) {
        moved = true
      }
    }
  } else if (direction === 'right') {
    for (let row = 0; row < GRID_SIZE; row++) {
      const reversedLine = [...board[row]].reverse()
      const { newLine, score } = moveLine(reversedLine)
      newBoard[row] = newLine.reverse()
      totalScore += score
      if (!arraysEqual(newBoard[row], board[row])) {
        moved = true
      }
    }
  } else if (direction === 'up') {
    for (let col = 0; col < GRID_SIZE; col++) {
      const column = board.map(row => row[col])
      const { newLine, score } = moveLine(column)
      for (let row = 0; row < GRID_SIZE; row++) {
        newBoard[row][col] = newLine[row]
      }
      totalScore += score
      if (!arraysEqual(newLine, column)) {
        moved = true
      }
    }
  } else if (direction === 'down') {
    for (let col = 0; col < GRID_SIZE; col++) {
      const column = board.map(row => row[col]).reverse()
      const { newLine, score } = moveLine(column)
      const reversedNewLine = newLine.reverse()
      for (let row = 0; row < GRID_SIZE; row++) {
        newBoard[row][col] = reversedNewLine[row]
      }
      totalScore += score
      if (!arraysEqual(reversedNewLine, board.map(row => row[col]))) {
        moved = true
      }
    }
  }

  return { newBoard, score: totalScore, moved }
}


// Check if game is won
const isGameWon = (board: GameBoard): boolean => {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === WINNING_NUMBER) {
        return true
      }
    }
  }
  return false
}

// Check if game is over (no moves possible)
const isGameOver = (board: GameBoard): boolean => {
  // Check for empty cells
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === null) {
        return false
      }
    }
  }

  // Check for possible merges
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const current = board[row][col]
      // Check right neighbor
      if (col < GRID_SIZE - 1 && board[row][col + 1] === current) {
        return false
      }
      // Check bottom neighbor
      if (row < GRID_SIZE - 1 && board[row + 1][col] === current) {
        return false
      }
    }
  }

  return true
}

// Get tile color based on value
const getTileColor = (value: number | null): string => {
  if (!value) return 'bg-[#cdc1b4]/60'

  const colors: { [key: number]: string } = {
    2: 'bg-[#eee4da] text-[#776e65] shadow-sm',
    4: 'bg-[#ede0c8] text-[#776e65] shadow-sm',
    8: 'bg-[#f2b179] text-white shadow-md',
    16: 'bg-[#f59563] text-white shadow-md',
    32: 'bg-[#f67c5f] text-white shadow-md',
    64: 'bg-[#f65e3b] text-white shadow-lg',
    128: 'bg-[#edcf72] text-white shadow-lg text-xl',
    256: 'bg-[#edcc61] text-white shadow-lg text-xl',
    512: 'bg-[#edc850] text-white shadow-lg text-xl',
    1024: 'bg-[#edc53f] text-white shadow-lg text-lg',
    2048: 'bg-[#edc22e] text-white shadow-lg text-lg font-black',
  }

  return colors[value] || 'bg-[#3c3a32] text-white shadow-lg text-lg'
}

// Get font size based on value
const getFontSize = (value: number | null): string => {
  if (!value) return ''
  if (value < 100) return 'text-4xl'
  if (value < 1000) return 'text-3xl'
  if (value < 10000) return 'text-2xl'
  return 'text-xl'
}

export default function Game2048() {
  const [board, setBoard] = useState<GameBoard>(initializeBoard)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [gameWon, setGameWon] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isProcessingMove, setIsProcessingMove] = useState(false)

  // Tutorial states
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false)

  // Powerup states
  const [powerupMode, setPowerupMode] = useState<PowerupMode>('none')
  const [selectedTiles, setSelectedTiles] = useState<[number, number][]>([])
  const [undoStack, setUndoStack] = useState<GameState[]>([])
  const [undoCount, setUndoCount] = useState(2)
  const [swapCount, setSwapCount] = useState(1)
  const [deleteCount, setDeleteCount] = useState(0)

  // Load saved data from localStorage
  useEffect(() => {
    const savedBestScore = safeLocalStorage.getItem('2048-best-score')
    const savedTutorial = safeLocalStorage.getItem('2048-tutorial-seen')

    if (savedBestScore) {
      setBestScore(Number.parseInt(savedBestScore))
    }

    if (savedTutorial) {
      setHasSeenTutorial(true)
    } else {
      // First time visit - show welcome then tutorial
      setShowWelcome(true)
    }
  }, [])

  // Save best score to localStorage
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score)
      safeLocalStorage.setItem('2048-best-score', score.toString())
    }
  }, [score, bestScore])

  // Process a move and handle all side effects
  const processMove = useCallback((direction: 'up' | 'down' | 'left' | 'right'): boolean => {
    // Save current state before move
    setUndoStack(prev => [...prev.slice(-4), { board, score }]) // Keep last 5 states

    const { newBoard, score: moveScore, moved } = moveBoard(board, direction)

    if (!moved) return false

    const boardWithNewTile = addRandomTile(newBoard)
    setBoard(boardWithNewTile)
    setScore(prev => prev + moveScore)

    // Check for powerup unlocks
    if (moveScore >= UNDO_UNLOCK_THRESHOLD && undoCount < MAX_UNDO_COUNT) {
      setUndoCount(prev => Math.min(prev + 1, MAX_UNDO_COUNT))
    }
    if (moveScore >= SWAP_UNLOCK_THRESHOLD && swapCount < MAX_SWAP_COUNT) {
      setSwapCount(prev => Math.min(prev + 1, MAX_SWAP_COUNT))
    }
    if (moveScore >= DELETE_UNLOCK_THRESHOLD && deleteCount < MAX_DELETE_COUNT) {
      setDeleteCount(prev => Math.min(prev + 1, MAX_DELETE_COUNT))
    }

    if (isGameWon(boardWithNewTile) && !gameWon) {
      setGameWon(true)
    }

    if (isGameOver(boardWithNewTile)) {
      setGameOver(true)
    }

    return true
  }, [board, score, undoCount, swapCount, deleteCount, gameWon])

  // Initialize game with two random tiles
  const startNewGame = useCallback(() => {
    let newBoard = initializeBoard()
    newBoard = addRandomTile(newBoard)
    newBoard = addRandomTile(newBoard)
    setBoard(newBoard)
    setScore(0)
    setGameWon(false)
    setGameOver(false)
    setShowWelcome(false)
    setPowerupMode('none')
    setSelectedTiles([])
    setUndoStack([])
    setUndoCount(2)
    setSwapCount(1)
    setDeleteCount(0)
  }, [])

  // Undo last move
  const handleUndo = useCallback(() => {
    if (undoCount > 0 && undoStack.length > 0) {
      const lastState = undoStack[undoStack.length - 1]
      setBoard(lastState.board)
      setScore(lastState.score)
      setUndoStack(prev => prev.slice(0, -1))
      setUndoCount(prev => prev - 1)
      setGameWon(false)
      setGameOver(false)
      // 重置道具状态
      setPowerupMode('none')
      setSelectedTiles([])
    }
  }, [undoCount, undoStack])

  // Handle tile selection for powerups
  const handleTileClick = useCallback((row: number, col: number) => {
    if (powerupMode === 'none' || !board[row][col]) return

    if (powerupMode === 'swap') {
      if (selectedTiles.length === 0) {
        setSelectedTiles([[row, col]])
      } else if (selectedTiles.length === 1) {
        const [firstRow, firstCol] = selectedTiles[0]
        if (firstRow === row && firstCol === col) {
          // Deselect if clicking same tile
          setSelectedTiles([])
        } else if (board[row][col]) {
          // Save state for undo before swapping
          setUndoStack(prev => [...prev.slice(-4), { board, score }])

          // Swap tiles
          const newBoard = board.map((r, rIdx) =>
            r.map((cell, cIdx) => {
              if (rIdx === firstRow && cIdx === firstCol) return board[row][col]
              if (rIdx === row && cIdx === col) return board[firstRow][firstCol]
              return cell
            })
          )
          setBoard(newBoard)
          setSwapCount(prev => prev - 1)
          setPowerupMode('none')
          setSelectedTiles([])
        }
      }
    } else if (powerupMode === 'delete') {
      // Delete all tiles with the same number
      const targetValue = board[row][col]
      if (targetValue && deleteCount > 0) {
        // Save state for undo before deleting
        setUndoStack(prev => [...prev.slice(-4), { board, score }])

        const newBoard = board.map(r => r.map(cell => cell === targetValue ? null : cell))

        // 检查棋盘是否为空，如果是则添加瓷砖
        const hasAnyTiles = newBoard.some(row => row.some(cell => cell !== null))
        let finalBoard = newBoard
        if (!hasAnyTiles) {
          const boardWithTile1 = addRandomTile(newBoard)
          finalBoard = addRandomTile(boardWithTile1)
        }

        setBoard(finalBoard)
        setDeleteCount(prev => prev - 1)
        setPowerupMode('none')
        setSelectedTiles([])

        // Check game state after deletion
        if (isGameOver(finalBoard)) {
          setGameOver(true)
        }
      }
    }
  }, [powerupMode, selectedTiles, board, score, deleteCount])

  // Handle keyboard input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (isProcessingMove || showTutorial || powerupMode !== 'none') return
    if (gameOver && !['KeyN', 'KeyR'].includes(event.code)) return

    let direction: 'up' | 'down' | 'left' | 'right' | null = null

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        direction = 'up'
        break
      case 'ArrowDown':
      case 'KeyS':
        direction = 'down'
        break
      case 'ArrowLeft':
      case 'KeyA':
        direction = 'left'
        break
      case 'ArrowRight':
      case 'KeyD':
        direction = 'right'
        break
      case 'KeyN':
      case 'KeyR':
        startNewGame()
        return
      case 'KeyZ':
        if (event.ctrlKey || event.metaKey) {
          handleUndo()
        }
        return
      case 'Escape':
        if (powerupMode !== 'none') {
          setPowerupMode('none')
          setSelectedTiles([])
        }
        return
      default:
        return
    }

    if (!direction) return

    event.preventDefault()
    setIsProcessingMove(true)
    
    const moved = processMove(direction)
    
    // Reset processing state after animation
    setTimeout(() => setIsProcessingMove(false), moved ? 150 : 0)
  }, [isProcessingMove, showTutorial, powerupMode, gameOver, processMove, startNewGame, handleUndo])

  // Attach keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Initialize game on mount
  const hasInitialized = useRef(false)
  useEffect(() => {
    if (!showWelcome && !showTutorial && hasSeenTutorial && !hasInitialized.current) {
      hasInitialized.current = true
      startNewGame()
    }
  }, [showWelcome, showTutorial, hasSeenTutorial, startNewGame])

  // Tutorial functions
  const startTutorial = () => {
    setShowWelcome(false)
    setShowTutorial(true)
    setTutorialStep(0)
  }

  const nextTutorialStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(prev => prev + 1)
    } else {
      setShowTutorial(false)
      setHasSeenTutorial(true)
      safeLocalStorage.setItem('2048-tutorial-seen', 'true')
      startNewGame()
    }
  }

  const skipTutorial = () => {
    setShowTutorial(false)
    setHasSeenTutorial(true)
    safeLocalStorage.setItem('2048-tutorial-seen', 'true')
    startNewGame()
  }

  const currentStep = TUTORIAL_STEPS[tutorialStep]

  return (
    <div className="min-h-screen bg-[#faf8ef] py-8">
      {/* Welcome Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="relative max-w-md rounded-xl bg-[#776e65] p-6 text-white shadow-xl">
            <button
              onClick={() => {
                setShowWelcome(false)
                setHasSeenTutorial(true)
                safeLocalStorage.setItem('2048-tutorial-seen', 'true')
                startNewGame()
              }}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#776e65] text-white text-xl hover:bg-[#8f7a93]"
            >
              ×
            </button>
            <div className="mb-6">
              <span className="mb-3 block font-bold uppercase text-xl">Welcome to 2048!</span>
              <div className="text-sm leading-relaxed">Would you like to learn how to play?</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={startTutorial}
                className="flex-1 rounded-lg bg-[#8f7a93] px-6 py-3 text-sm font-semibold text-white hover:bg-[#9d889c] transition-colors"
              >
                Play Tutorial
              </button>
              <button
                onClick={() => {
                  setShowWelcome(false)
                  setHasSeenTutorial(true)
                  safeLocalStorage.setItem('2048-tutorial-seen', 'true')
                  startNewGame()
                }}
                className="flex-1 rounded-lg bg-[#bbada0] px-6 py-3 text-sm font-semibold text-white hover:bg-[#a89d94] transition-colors"
              >
                Skip Tutorial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative max-w-lg rounded-xl bg-[#776e65] p-8 text-white shadow-xl">
            <div className="mb-6">
              <span className="mb-3 block font-bold text-xl">{currentStep.title}</span>
              <div className="text-sm leading-relaxed">{currentStep.description}</div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">
                Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={skipTutorial}
                  className="rounded-lg bg-[#bbada0] px-5 py-2 text-sm text-white hover:bg-[#a89d94] transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={nextTutorialStep}
                  className="rounded-lg bg-[#8f7a93] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9d889c] transition-colors"
                >
                  {tutorialStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Start Game'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
        {/* Header */}
        <header className="w-full max-w-lg" id="score-section">
          <div className="text-center mb-6">
            <h1 className="text-7xl font-bold text-[#776e65] mb-2">2048</h1>
            <p className="text-[#776e65] text-sm">Join numbers to get the 2048 tile!</p>
          </div>

          {/* 三个色块一行，宽度与棋盘一致 */}
          <div className="flex w-full max-w-[420px] mx-auto gap-0 h-[72px]">
            {/* Score */}
            <div className="flex-1 flex flex-col items-center justify-center rounded-l-lg bg-[#bbada0] px-4 py-3 text-white h-full">
              <span className="text-xs font-bold uppercase tracking-wide">Score</span>
              <span className="text-xl font-bold">{score}</span>
            </div>
            {/* Best Score */}
            <div className="flex-1 flex flex-col items-center justify-center bg-[#bbada0] px-4 py-3 text-white border-l border-r border-[#faf8ef] h-full">
              <span className="text-xs font-bold uppercase tracking-wide">Best</span>
              <span className="text-xl font-bold">{bestScore}</span>
            </div>
            {/* New Game Button */}
            <button
              onClick={startNewGame}
              className="flex-1 rounded-r-lg bg-[#8f7a93] px-4 py-3 text-white font-bold hover:bg-[#9d889c] transition-colors shadow-sm text-sm h-full flex flex-col items-center justify-center"
              style={{ minWidth: 0 }}
            >
              New Game
            </button>
          </div>
        </header>

        {/* Game Board Container */}
        <div className="relative" id="game-board">
          <div
            className="grid grid-cols-4 gap-2 sm:gap-4 rounded-xl bg-[#bbada0] p-3 sm:p-5 shadow-lg mx-auto"
            style={{ 
              width: 'min(420px, 90vw)', 
              height: 'min(420px, 90vw)' 
            }}
          >
            {board.flat().map((cell, index) => {
              const row = Math.floor(index / GRID_SIZE)
              const col = index % GRID_SIZE
              const isSelected = selectedTiles.some(([r, c]) => r === row && c === col)
              const canClick = powerupMode !== 'none' && cell !== null

              return (
                <div
                  key={`${row}-${col}`}
                  className={`flex items-center justify-center rounded-lg font-bold transition-all duration-200 ease-in-out ${getTileColor(cell)} ${getFontSize(cell)} ${
                    cell ? 'transform scale-100' : ''
                  } ${isSelected ? 'ring-4 ring-[#8f7a93] ring-opacity-70' : ''} ${
                    canClick ? 'cursor-pointer hover:scale-105' : ''
                  }`}
                  style={{ width: '84px', height: '84px' }}
                  onClick={() => handleTileClick(row, col)}
                >
                  {cell && (
                    <span className={`inline-block transition-all duration-150 ${
                      cell ? 'animate-in zoom-in-50 duration-200' : ''
                    }`}>
                      {cell}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Powerup mode indicator */}
          {powerupMode !== 'none' && (
            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-[#776e65] text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
              {powerupMode === 'swap' && 'Select two tiles to swap'}
              {powerupMode === 'delete' && 'Click a tile to delete all matching numbers'}
              <button
                onClick={() => {
                  setPowerupMode('none')
                  setSelectedTiles([])
                }}
                className="ml-3 text-white/70 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Game Status Messages */}
        {gameWon && (
          <div className="rounded-lg bg-[#edc22e] px-8 py-4 text-white font-bold shadow-lg animate-in slide-in-from-bottom-4 duration-300 text-center">
            🎉 You Win! You reached 2048!
          </div>
        )}

        {gameOver && (
          <div className="rounded-lg bg-[#edc53f] px-8 py-4 text-white font-bold shadow-lg animate-in slide-in-from-bottom-4 duration-300 text-center">
            Game Over! Press N or R for a new game.
          </div>
        )}

        {/* Powerups Section */}
        <div className="w-full max-w-lg" id="powerups-section">
          <div className="flex w-full max-w-[420px] mx-auto gap-0 rounded-2xl bg-[#e6ddd4] p-4">
            {/* Undo */}
            <div className="group relative flex-1 flex flex-col items-center gap-2">
              <div className="absolute -top-20 z-30 hidden w-max max-w-64 rounded-xl bg-[#776e65] px-4 py-3 text-xs text-white opacity-0 group-hover:block group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="mb-1 flex items-start gap-2">
                  <span className="font-medium uppercase">Undo</span>
                  <span className="opacity-70">{undoCount} uses left</span>
                </div>
                <span className="opacity-70">Undo last move. Earn 128+ points in one merge for more uses</span>
              </div>
              <div className="relative">
                <button
                  onClick={handleUndo}
                  disabled={undoCount === 0}
                  className={`flex h-16 w-16 items-center justify-center rounded-lg text-white transition-all duration-150 hover:scale-105 ${
                    undoCount > 0 ? 'bg-[#bbada0] hover:bg-[#8f7a93]' : 'bg-[#bbada0]/30 opacity-50'
                  }`}
                >
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                  </svg>
                </button>
                {undoCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                    {undoCount}
                  </span>
                )}
              </div>
              <div className="flex gap-[3px] self-stretch px-2">
                <div className={`h-[3px] flex-auto rounded-full ${undoCount > 0 ? 'bg-[#bbada0]' : 'bg-[#bbada0]/30'}`} />
              </div>
            </div>

            {/* Swap */}
            <div className="group relative flex-1 flex flex-col items-center gap-2">
              <div className="absolute -top-20 z-30 hidden w-max max-w-64 rounded-xl bg-[#776e65] px-4 py-3 text-xs text-white opacity-0 group-hover:block group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="mb-1 flex items-start gap-2">
                  <span className="font-medium uppercase">Swap Tiles</span>
                  <span className="opacity-70">{swapCount} uses left</span>
                </div>
                <span className="opacity-70">Swap two tiles. Earn 256+ points in one merge for more uses</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setPowerupMode(powerupMode === 'swap' ? 'none' : 'swap')}
                  disabled={swapCount === 0}
                  className={`flex h-16 w-16 items-center justify-center rounded-lg text-white transition-all duration-150 hover:scale-105 ${
                    powerupMode === 'swap' ? 'bg-[#8f7a93] scale-105' :
                    swapCount > 0 ? 'bg-[#bbada0] hover:bg-[#8f7a93]' : 'bg-[#bbada0]/30 opacity-50'
                  }`}
                >
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
                  </svg>
                </button>
                {swapCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                    {swapCount}
                  </span>
                )}
              </div>
              <div className="flex gap-[3px] self-stretch px-2">
                <div className={`h-[3px] flex-auto rounded-full ${swapCount > 0 ? 'bg-[#bbada0]' : 'bg-[#bbada0]/30'}`} />
              </div>
            </div>

            {/* Delete */}
            <div className="group relative flex-1 flex flex-col items-center gap-2">
              <div className="absolute -top-20 z-30 hidden w-max max-w-64 rounded-xl bg-[#776e65] px-4 py-3 text-xs text-white opacity-0 group-hover:block group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="mb-1 flex items-start gap-2">
                  <span className="font-medium uppercase">Delete Number</span>
                  <span className="opacity-70">{deleteCount} uses left</span>
                </div>
                <span className="opacity-70">Delete all same numbers. Earn 512+ points to unlock</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setPowerupMode(powerupMode === 'delete' ? 'none' : 'delete')}
                  disabled={deleteCount === 0}
                  className={`flex h-16 w-16 items-center justify-center rounded-lg text-white transition-all duration-150 hover:scale-105 ${
                    powerupMode === 'delete' ? 'bg-[#8f7a93] scale-105' :
                    deleteCount > 0 ? 'bg-[#bbada0] hover:bg-[#8f7a93]' : 'bg-[#bbada0]/30 opacity-50'
                  }`}
                >
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
                {deleteCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                    {deleteCount}
                  </span>
                )}
              </div>
              <div className="flex gap-[3px] self-stretch px-2">
                <div className={`h-[3px] flex-auto rounded-full ${deleteCount > 0 ? 'bg-[#bbada0]' : 'bg-[#bbada0]/30'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* How to Play Section */}
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-[#776e65] mb-6 text-center">How to Play</h2>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-[#776e65]">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2 text-base text-[#8f7a93]">
                    Goal
                  </h3>
                  <p>Combine tiles with the same number to reach <strong>2048</strong>!</p>
                </div>
                <div>
                  <h3 className="font-bold mb-2 text-base text-[#8f7a93]">
                    Controls
                  </h3>
                  <p>Use <strong>arrow keys</strong> or <strong>WASD</strong> to slide tiles. All tiles move together in the chosen direction.</p>
                  <p className="mt-2 text-xs opacity-75">Tip: Press <strong>Ctrl/Cmd+Z</strong> to undo, <strong>N</strong> or <strong>R</strong> to restart.</p>
                </div>
                <div>
                  <h3 className="font-bold mb-2 text-base text-[#8f7a93]">
                    Merging
                  </h3>
                  <p>When two tiles with the same number touch, they merge!<br/>2 + 2 = 4, 4 + 4 = 8, etc.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2 text-base text-[#8f7a93]">
                    New Tiles
                  </h3>
                  <p>After each move, a new tile (2 or 4) appears randomly.</p>
                </div>
                <div>
                  <h3 className="font-bold mb-2 text-base text-[#8f7a93]">
                    Game Over
                  </h3>
                  <p>Game ends when no moves or merges are possible.</p>
                </div>
                <div>
                  <h3 className="font-bold mb-2 text-base text-[#8f7a93]">
                    Power-ups
                  </h3>
                  <p>Earn power-ups by merging tiles! Undo moves, swap tiles, or delete numbers.</p>
                </div>
              </div>
            </div>

            {hasSeenTutorial && (
              <div className="mt-6 text-center">
                <button
                  onClick={startTutorial}
                  className="rounded-lg bg-[#8f7a93] px-6 py-2 text-white hover:bg-[#9d889c] transition-colors text-sm font-medium"
                >
                  View Tutorial Again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[#776e65] opacity-40 mt-8">
          All rights reserved.
        </div>
      </div>
    </div>
  )
}
