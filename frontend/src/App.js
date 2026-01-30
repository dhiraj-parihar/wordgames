import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import LandingPage from './components/LandingPage';
import BattleArena from './components/BattleArena';

function App() {
  const [username, setUsername] = useState(null);
  const [playerData, setPlayerData] = useState(null);

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              username ? (
                <BattleArena username={username} playerData={playerData} />
              ) : (
                <LandingPage setUsername={setUsername} setPlayerData={setPlayerData} />
              )
            } 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
