import { motion } from 'framer-motion';

const MatchQueue = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative z-10 min-h-screen flex items-center justify-center"
    >
      <div className="text-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="font-orbitron text-3xl uppercase tracking-widest text-primary mb-8"
        >
          SEARCHING FOR OPPONENT
        </motion.div>
        
        <div className="flex gap-3 justify-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -20, 0] }}
              transition={{
                repeat: Infinity,
                duration: 1,
                delay: i * 0.2
              }}
              className="w-4 h-4 bg-primary neon-glow-cyan"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default MatchQueue;
