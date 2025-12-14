import { useEffect, useState } from 'react'
import './styles/game.css'
import Minigame1 from './components/layout/Minigame1'

function App() {
  const [currentMinigame] = useState(1); // Siempre Wordle

  return (
    <div className="game-container">
      <Minigame1 />
    </div>
  );
}

export default App;