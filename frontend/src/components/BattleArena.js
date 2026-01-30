import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import MatchQueue from './MatchQueue';
import GameHUD from './GameHUD';
import EndScreen from './EndScreen';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = BACKEND_URL.replace(/^http/, 'ws');

const BattleArena = ({ username, playerData }) => {
  const [gameState, setGameState] = useState('menu'); // menu, queue, countdown, battle, ended
  const [ws, setWs] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [typedText, setTypedText] = useState('');
  const [playerState, setPlayerState] = useState({ hp: 100, shields: 0, combo: 0, accuracy: 100 });
  const [opponentState, setOpponentState] = useState({ hp: 100, shields: 0, combo: 0, accuracy: 100 });
  const [matchResult, setMatchResult] = useState(null);
  const [animations, setAnimations] = useState([]);
  const inputRef = useRef(null);
  const matchStartTime = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(`${WS_URL}/api/ws/${username}`);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      setWs(socket);
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      
      if (data.type === 'queue_joined') {
        setGameState('queue');
      } else if (data.type === 'match_found') {
        setMatchData({
          matchId: data.match_id,
          opponent: data.opponent,
          text: data.text,
          yourSide: data.your_side
        });
        setGameState('countdown');
      } else if (data.type === 'countdown') {
        setCountdown(data.count);
      } else if (data.type === 'match_started') {
        setGameState('battle');
        setCountdown(null);
        matchStartTime.current = Date.now();
        setTimeout(() => inputRef.current?.focus(), 100);
      } else if (data.type === 'game_state') {
        setPlayerState(data.player);
        setOpponentState(data.opponent);
      } else if (data.type === 'shield_gained') {
        playSound('shield');
        addAnimation({ type: 'shield', target: 'player' });
      } else if (data.type === 'shield_blocked') {
        playSound('shield');
        addAnimation({ type: 'block', target: 'player' });
      } else if (data.type === 'damage_taken') {
        playSound('hit');
        addAnimation({ type: 'damage', target: 'player', value: data.damage });
      } else if (data.type === 'attack_sent') {
        playSound('attack');
        addAnimation({ type: 'projectile', from: 'player', to: 'opponent', damage: data.damage });
      } else if (data.type === 'match_ended') {
        setGameState('ended');
        setMatchResult({
          result: data.result,
          reason: data.reason,
          rankChange: data.rank_change,
          newRank: data.new_rank,
          rankName: data.rank_name,
          accuracy: data.accuracy,
          finalHp: data.final_hp
        });
        playSound(data.result === 'victory' ? 'victory' : 'defeat');
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [username]);

  useEffect(() => {
    if (gameState === 'battle' && matchStartTime.current) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - matchStartTime.current) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [gameState]);

  const addAnimation = (anim) => {
    const id = Date.now() + Math.random();
    setAnimations(prev => [...prev, { ...anim, id }]);
    setTimeout(() => {
      setAnimations(prev => prev.filter(a => a.id !== id));
    }, 1000);
  };

  const playSound = (type) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
      case 'key':
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.05;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.05);
        break;
      case 'attack':
        oscillator.frequency.value = 440;
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      case 'shield':
        oscillator.frequency.value = 1200;
        gainNode.gain.value = 0.08;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
      case 'hit':
        oscillator.frequency.value = 200;
        gainNode.gain.value = 0.15;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
      case 'victory':
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.15;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      case 'defeat':
        oscillator.frequency.value = 110;
        gainNode.gain.value = 0.15;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.4);
        break;
      default:
        break;
    }
  };

  const handleJoinQueue = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'join_queue' }));
    }
  };

  const handleTyping = (e) => {
    const newText = e.target.value;
    setTypedText(newText);
    
    if (newText.length > typedText.length) {
      playSound('key');
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'keystroke',
        typed: newText
      }));
    }
  };

  const handlePlayAgain = () => {
    setGameState('menu');
    setMatchData(null);
    setMatchResult(null);
    setTypedText('');
    setPlayerState({ hp: 100, shields: 0, combo: 0, accuracy: 100 });
    setOpponentState({ hp: 100, shields: 0, combo: 0, accuracy: 100 });
    setTimeLeft(60);
    matchStartTime.current = null;
  };

  return (
    <div 
      className="min-h-screen w-full relative overflow-hidden"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1641650265007-b2db704cd9f3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHw0fHxjeWJlcnB1bmslMjBjaXR5JTIwbmVvbiUyMG5pZ2h0fGVufDB8fHx8MTc2OTc0MTA3NHww&ixlib=rb-4.1.0&q=85')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/80 scanlines" />
      
      <AnimatePresence mode="wait">
        {gameState === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8"
          >
            <div className="text-center mb-12">
              <h1 className="font-orbitron font-black text-4xl sm:text-5xl mb-4 uppercase tracking-widest text-primary neon-glow-cyan">
                WELCOME, {username}
              </h1>
              <div className="glass inline-block px-6 py-3">
                <p className="font-rajdhani text-lg">
                  RANK: <span className="text-accent font-bold">{playerData?.rank_name || 'Bronze'}</span> ({playerData?.rank || 1000})
                </p>
                <p className="font-rajdhani text-sm text-[#888888] mt-1">
                  W: {playerData?.wins || 0} / L: {playerData?.losses || 0}
                </p>
              </div>
            </div>
            
            <button
              data-testid="ranked-match-btn"
              onClick={handleJoinQueue}
              className="bg-primary hover:bg-primary/90 text-black font-orbitron font-bold text-2xl uppercase tracking-wider py-6 px-16 transition-all neon-glow-cyan"
            >
              RANKED MATCH
            </button>
          </motion.div>
        )}

        {gameState === 'queue' && (
          <MatchQueue key="queue" />
        )}

        {gameState === 'countdown' && matchData && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 min-h-screen flex items-center justify-center"
          >
            <div className="text-center">
              <p className="font-rajdhani text-xl mb-8 text-[#888888]">
                VS <span className="text-secondary">{matchData.opponent}</span>
              </p>
              <motion.div
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-orbitron font-black text-9xl text-primary neon-glow-cyan"
              >
                {countdown || 'GO!'}
              </motion.div>
            </div>
          </motion.div>
        )}

        {gameState === 'battle' && matchData && (
          <GameHUD
            key="battle"
            matchData={matchData}
            timeLeft={timeLeft}
            typedText={typedText}
            handleTyping={handleTyping}
            inputRef={inputRef}
            playerState={playerState}
            opponentState={opponentState}
            animations={animations}
          />
        )}

        {gameState === 'ended' && matchResult && (
          <EndScreen
            key="ended"
            result={matchResult}
            handlePlayAgain={handlePlayAgain}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default BattleArena;
