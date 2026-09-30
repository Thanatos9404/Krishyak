// Adapted from Magic UI's MIT-licensed ShineBorder (listed on 21st.dev).
// See frontend/THIRD_PARTY_NOTICES.md. Plain CSS keeps the existing React stack.
import React from 'react';

export default function ShineBorder({ color = '#d2b477', duration = 14 }) {
  return <span aria-hidden="true" className="shine-border" style={{
    '--shine-duration': `${duration}s`,
    backgroundImage: `radial-gradient(transparent, transparent, ${color}, transparent, transparent)`,
    backgroundSize: '300% 300%',
    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: '1px',
  }} />;
}
