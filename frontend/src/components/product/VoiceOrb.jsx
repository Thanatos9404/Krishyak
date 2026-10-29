import { motion, useReducedMotion } from "framer-motion";
import { Mic, Square } from "lucide-react";

const RINGS = [0, 0.6, 1.2];

// The large animated microphone at the heart of voice mode. Its motion tells
// the farmer what is happening without reading: rings while listening, a
// turning halo while thinking, moving bars while speaking.
export function VoiceOrb({
  phase = "idle",
  size = 168,
  label,
  onClick,
  disabled,
}) {
  const still = useReducedMotion();
  const listening = phase === "listening";
  const thinking = phase === "thinking" || phase === "transcribing";
  const speaking = phase === "speaking";
  return (
    <div
      className={`voice-orb phase-${phase}`}
      style={{ "--orb-size": `${size}px` }}
    >
      {listening &&
        !still &&
        RINGS.map((delay) => (
          <motion.span
            key={delay}
            className="voice-orb-ring"
            aria-hidden="true"
            initial={{ scale: 1, opacity: 0.55 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay,
              ease: "easeOut",
            }}
          />
        ))}
      {thinking && (
        <motion.span
          className="voice-orb-halo"
          aria-hidden="true"
          animate={still ? undefined : { rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      )}
      <motion.button
        type="button"
        className="voice-orb-button"
        aria-label={label}
        aria-pressed={listening}
        disabled={disabled}
        onClick={onClick}
        whileTap={still ? undefined : { scale: 0.94 }}
        animate={
          still || listening || thinking || speaking
            ? { scale: 1 }
            : { scale: [1, 1.04, 1] }
        }
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {speaking ? (
          <span className="voice-bars" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((bar) => (
              <motion.i
                key={bar}
                animate={
                  still ? undefined : { scaleY: [0.35, 1, 0.5, 0.9, 0.35] }
                }
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: bar * 0.12,
                  ease: "easeInOut",
                }}
              />
            ))}
          </span>
        ) : listening ? (
          <Square size={size * 0.24} fill="currentColor" aria-hidden="true" />
        ) : (
          <Mic size={size * 0.34} strokeWidth={1.8} aria-hidden="true" />
        )}
      </motion.button>
    </div>
  );
}
