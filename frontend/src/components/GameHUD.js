import { motion } from 'framer-motion';
import { useEffect } from 'react';

const GameHUD = ({ matchData, timeLeft, typedText, handleTyping, inputRef, playerState, opponentState, animations }) => {
  const renderText = () => {
    const text = matchData.text;
    const typed = typedText;
    
    return (
      <div className="font-mono text-2xl sm:text-3xl leading-relaxed">
        {text.split('').map((char, i) => {
          let className = 'text-[#888888]';
          
          if (i < typed.length) {
            if (typed[i] === char) {
              className = 'text-primary';
            } else {
              className = 'text-[#FF2A2A]';
            }
          } else if (i === typed.length) {
            className = 'text-white bg-primary/30';
          }
          
          return (
            <span key={i} className={className}>
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative z-10 min-h-screen flex flex-col p-4 sm:p-8"
    >
      {/* Timer */}
      <div className="text-center mb-6">
        <div 
          data-testid="battle-timer"
          className="font-orbitron font-black text-5xl sm:text-6xl inline-block"
          style={{
            color: timeLeft <= 10 ? '#FF2A2A' : '#00F0FF',
            textShadow: timeLeft <= 10 
              ? '0 0 20px rgba(255, 42, 42, 0.8)' 
              : '0 0 20px rgba(0, 240, 255, 0.8)'
          }}
        >
          {timeLeft}s
        </div>
      </div>

      {/* Player vs Opponent */}
      <div className="grid grid-cols-2 gap-4 sm:gap-8 mb-6">
        {/* Player */}
        <motion.div 
          className="glass p-4 sm:p-6"
          animate={animations.some(a => a.target === 'player' && a.type === 'damage') ? { x: [-4, 4, -4, 4, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-rajdhani font-bold text-lg uppercase">YOU</span>
            <span className="font-mono text-accent">{Math.round(playerState.accuracy)}%</span>
          </div>
          
          {/* HP Bar */}
          <div 
            data-testid="player-hp"
            className="h-4 w-full bg-white/5 overflow-hidden mb-2 border border-white/10"
          >
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '100%' }}
              animate={{ width: `${playerState.hp}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="font-rajdhani text-sm text-[#888888]">
            HP: {playerState.hp}/100
          </p>
          
          {/* Shields & Combo */}
          <div className="flex gap-4 mt-3">
            <div>
              <span className="text-accent font-bold">🛡️ {playerState.shields}</span>
            </div>
            <div>
              <span className="text-white">⚡ {playerState.combo}</span>
            </div>
          </div>
        </motion.div>

        {/* Opponent */}
        <motion.div 
          className="glass p-4 sm:p-6"
          animate={animations.some(a => a.target === 'opponent' && a.type === 'damage') ? { x: [-4, 4, -4, 4, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-rajdhani font-bold text-lg uppercase">{matchData.opponent}</span>
            <span className="font-mono text-accent">{Math.round(opponentState.accuracy)}%</span>
          </div>
          
          {/* HP Bar */}
          <div 
            data-testid="opponent-hp"
            className="h-4 w-full bg-white/5 overflow-hidden mb-2 border border-white/10"
          >
            <motion.div
              className="h-full bg-secondary"
              initial={{ width: '100%' }}
              animate={{ width: `${opponentState.hp}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="font-rajdhani text-sm text-[#888888]">
            HP: {opponentState.hp}/100
          </p>
          
          {/* Shields & Combo */}
          <div className="flex gap-4 mt-3">
            <div>
              <span className="text-accent font-bold">🛡️ {opponentState.shields}</span>
            </div>
            <div>
              <span className="text-white">⚡ {opponentState.combo}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Typing Area */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-12">
        <div className="glass p-6 sm:p-12 max-w-4xl w-full">
          {renderText()}
          
          <input
            ref={inputRef}
            data-testid="battle-input"
            type="text"
            value={typedText}
            onChange={handleTyping}
            className="opacity-0 absolute -left-[9999px]"
            autoFocus
          />
        </div>
      </div>

      {/* Projectile Animations */}
      {animations.map(anim => {
        if (anim.type === 'projectile') {
          return (
            <motion.div
              key={anim.id}
              className="absolute top-1/4 left-1/4 w-4 h-4 rounded-full"
              style={{
                backgroundColor: anim.from === 'player' ? '#00F0FF' : '#FF0099',
                boxShadow: `0 0 20px ${anim.from === 'player' ? 'rgba(0,240,255,0.8)' : 'rgba(255,0,153,0.8)'}`
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              animate={{ 
                x: anim.from === 'player' ? 400 : -400,
                y: 0,
                scale: 0.5,
                opacity: 0
              }}
              transition={{ duration: 0.5 }}
            />
          );
        }
        return null;
      })}
    </motion.div>
  );
};

export default GameHUD;
