import { createContext, useContext } from "react";

// Lets any screen open the shared voice mode (for example the big mic on Home).
export const VoiceLauncher = createContext(null);
export const useVoiceLauncher = () => useContext(VoiceLauncher);

// Example questions shown on Home and in voice mode.
export const SUGGESTIONS = [
  "Will it rain in the next two days?",
  "What is the mandi price of my crop?",
  "My plant leaves have spots. What should I do?",
  "When should I water my field?",
  "Which government schemes can help me?",
];
