import { motion } from 'framer-motion';

const EndScreen = ({ result, handlePlayAgain }) => {
  const isVictory = result.result === 'victory';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="relative z-10 min-h-screen flex items-center justify-center p-4"
    >
      <div className="text-center">
        <motion.h1 
          className="font-orbitron font-black text-6xl sm:text-8xl uppercase tracking-widest mb-8"
          style={{
            color: isVictory ? '#00F0FF' : '#FF2A2A',
            textShadow: isVictory 
              ? '0 0 30px rgba(0, 240, 255, 1), 0 0 60px rgba(0, 240, 255, 0.5)'
              : '0 0 30px rgba(255, 42, 42, 1), 0 0 60px rgba(255, 42, 42, 0.5)'
          }}
        >
          {isVictory ? 'VICTORY' : 'DEFEAT'}
        </motion.h1>

        <div className="glass p-8 max-w-md mx-auto mb-8">
          <div className="space-y-4 font-rajdhani text-lg">
            <div className="flex justify-between items-center">
              <span className="text-[#888888]">ACCURACY:</span>
              <span className="text-accent font-bold">{Math.round(result.accuracy)}%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[#888888]">FINAL HP:</span>
              <span className="text-white font-bold">{result.finalHp}</span>
            </div>
            
            <div className="h-px bg-white/10 my-4" />
            
            <div className="flex justify-between items-center">
              <span className="text-[#888888]">RANK CHANGE:</span>
              <span 
                className="font-bold text-xl"
                style={{ color: result.rankChange > 0 ? '#39FF14' : '#FF2A2A' }}
              >
                {result.rankChange > 0 ? '+' : ''}{result.rankChange}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[#888888]">NEW RANK:</span>
              <span className="text-primary font-bold">{result.rankName} ({result.newRank})</span>
            </div>
          </div>
        </div>

        <button
          data-testid="play-again-btn"
          onClick={handlePlayAgain}
          className="bg-primary hover:bg-primary/90 text-black font-orbitron font-bold text-xl uppercase tracking-wider py-4 px-12 transition-all neon-glow-cyan"
        >
          PLAY AGAIN
        </button>
      </div>
    </motion.div>
  );
};

export default EndScreen;
