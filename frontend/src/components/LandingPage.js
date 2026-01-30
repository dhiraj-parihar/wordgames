import { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LandingPage = ({ setUsername, setPlayerData }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!usernameInput.trim()) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/player`, {
        username: usernameInput.trim()
      });
      
      setPlayerData(response.data);
      setUsername(usernameInput.trim());
    } catch (error) {
      console.error('Error creating player:', error);
      alert('Failed to join. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1728330458318-70438beffc44?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwzfHxjeWJlcnB1bmslMjBjaXR5JTIwbmVvbiUyMG5pZ2h0fGVufDB8fHx8MTc2OTc0MTA3NHww&ixlib=rb-4.1.0&q=85')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/70 scanlines" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center px-4"
      >
        <motion.h1 
          className="font-orbitron font-black text-6xl sm:text-7xl lg:text-8xl uppercase tracking-widest mb-4"
          style={{
            textShadow: '0 0 20px rgba(0, 240, 255, 0.8), 0 0 40px rgba(0, 240, 255, 0.4)'
          }}
        >
          <span className="text-primary">WORD</span>
          <span className="text-white mx-4">vs</span>
          <span className="text-secondary">DUELIST</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-rajdhani text-lg sm:text-xl text-[#888888] mb-12 tracking-wide"
        >
          TYPE FAST. TYPE ACCURATE. SURVIVE.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-none p-8 max-w-md mx-auto"
        >
          <input
            data-testid="username-input"
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleStart()}
            placeholder="ENTER USERNAME"
            className="w-full bg-black/50 border-b-2 border-white/20 focus:border-primary outline-none font-mono text-lg p-4 placeholder:text-white/30 text-center uppercase tracking-wider transition-colors"
            disabled={loading}
          />
          
          <button
            data-testid="enter-arena-btn"
            onClick={handleStart}
            disabled={loading || !usernameInput.trim()}
            className="w-full mt-6 bg-primary hover:bg-primary/90 text-black font-orbitron font-bold text-xl uppercase tracking-wider py-4 px-8 transition-all disabled:opacity-50 disabled:cursor-not-allowed neon-glow-cyan"
          >
            {loading ? 'CONNECTING...' : 'ENTER ARENA'}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 space-y-2 text-sm font-rajdhani text-[#888888]"
        >
          <p>⚡ 60-SECOND MATCHES</p>
          <p>🛡️ SHIELDS FROM ACCURACY</p>
          <p>⚔️ ATTACKS FROM SPEED</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LandingPage;
