"use client";
import { motion, useReducedMotion } from "framer-motion";
import { CloudRain, IndianRupee, Leaf, Mic } from "lucide-react";
import { useProductLocale } from "../../features/product/ProductLocale";

const float = (still, delay, distance = 10) =>
  still
    ? {}
    : {
        animate: { y: [0, -distance, 0] },
        transition: { duration: 5, repeat: Infinity, delay, ease: "easeInOut" },
      };

// Illustrated hero: sun, hills and crop rows drawn as shapes, with a phone
// showing a voice conversation. Everything is decorative except the phone
// text, which is labelled as an example.
export function HeroScene() {
  const { tx } = useProductLocale();
  const still = useReducedMotion();
  return (
    <div className="hero-scene">
      <svg
        className="hero-land"
        viewBox="0 0 640 520"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hero-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff4d6" />
            <stop offset="1" stopColor="#e9f3dc" />
          </linearGradient>
          <linearGradient id="hero-hill-a" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7fb069" />
            <stop offset="1" stopColor="#4f8a3c" />
          </linearGradient>
          <linearGradient id="hero-hill-b" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3f7d3a" />
            <stop offset="1" stopColor="#245c31" />
          </linearGradient>
        </defs>
        <rect width="640" height="520" rx="36" fill="url(#hero-sky)" />
        <motion.g
          style={{ originX: "500px", originY: "120px" }}
          animate={still ? undefined : { rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <rect
              key={index}
              x="497"
              y="40"
              width="6"
              height="22"
              rx="3"
              fill="#f5b83d"
              transform={`rotate(${index * 30} 500 120)`}
            />
          ))}
        </motion.g>
        <circle cx="500" cy="120" r="46" fill="#f7c548" />
        <motion.path
          d="M40 120 q20 -18 40 0 q20 -18 40 0"
          stroke="#ffffff"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
          animate={still ? undefined : { x: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <path
          d="M0 330 C120 270 220 300 330 320 S540 280 640 300 V520 H0 Z"
          fill="url(#hero-hill-a)"
        />
        <path
          d="M0 400 C140 350 260 380 380 390 S560 360 640 380 V520 H0 Z"
          fill="url(#hero-hill-b)"
        />
        {Array.from({ length: 9 }, (_, index) => (
          <path
            key={index}
            d={`M${-40 + index * 80} 520 Q${150 + index * 40} 430 ${260 + index * 22} 400`}
            stroke="#8cc26b"
            strokeWidth="3"
            fill="none"
            opacity="0.45"
          />
        ))}
        {[110, 170, 230].map((x, index) => (
          <motion.g
            key={x}
            animate={still ? undefined : { rotate: [-4, 4, -4] }}
            style={{ originX: `${x}px`, originY: "330px" }}
            transition={{
              duration: 4,
              repeat: Infinity,
              delay: index * 0.4,
              ease: "easeInOut",
            }}
          >
            <path d={`M${x} 332 v-46`} stroke="#2f6b2c" strokeWidth="4" />
            <ellipse
              cx={x - 12}
              cy="300"
              rx="13"
              ry="6"
              fill="#5aa04a"
              transform={`rotate(-30 ${x - 12} 300)`}
            />
            <ellipse
              cx={x + 12}
              cy="290"
              rx="13"
              ry="6"
              fill="#6db457"
              transform={`rotate(30 ${x + 12} 290)`}
            />
          </motion.g>
        ))}
      </svg>
      <div className="hero-phone rise-in delayed">
        <span className="hero-phone-notch" aria-hidden="true" />
        <p className="hero-phone-label">{tx("Example conversation")}</p>
        <div className="hero-bubble farmer">
          {tx("Will it rain in the next two days?")}
        </div>
        <div className="hero-bubble helper">
          {tx(
            "Light rain is likely tomorrow evening. Wait before spraying, and check that water can drain.",
          )}
        </div>
        <div className="hero-phone-mic" aria-hidden="true">
          {!still &&
            [0, 0.8].map((delay) => (
              <motion.span
                key={delay}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, delay }}
              />
            ))}
          <Mic size={30} />
        </div>
      </div>
      <motion.div
        className="hero-chip chip-weather"
        aria-hidden="true"
        {...float(still, 0)}
      >
        <CloudRain size={20} /> {tx("Rain tomorrow")}
      </motion.div>
      <motion.div
        className="hero-chip chip-price"
        aria-hidden="true"
        {...float(still, 1.2, 8)}
      >
        <IndianRupee size={20} /> {tx("Mandi rate rising")}
      </motion.div>
      <motion.div
        className="hero-chip chip-leaf"
        aria-hidden="true"
        {...float(still, 2.2, 12)}
      >
        <Leaf size={20} /> {tx("Leaf check ready")}
      </motion.div>
    </div>
  );
}
