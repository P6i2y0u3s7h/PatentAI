import React from 'react';

interface AssistantAvatarProps {
  size?: number | string;
  className?: string;
  animate?: boolean;
}

export const AssistantAvatar: React.FC<AssistantAvatarProps> = ({
  size = 32,
  className = '',
  animate = false,
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 group ${
        animate ? 'hover:scale-105 transition-transform duration-300' : ''
      } ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full rounded-full transition-all duration-300"
        style={{
          filter: 'drop-shadow(0 0 7px rgba(45, 212, 191, 0.45))',
        }}
      >
        <defs>
          {/* Subtle gradient for inner turquoise background */}
          <linearGradient id="robotTurquoiseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="60%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>

          {/* Neon outer ring gradient */}
          <linearGradient id="robotRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="50%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>

        {/* Outer Circular Turquoise Background */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="url(#robotTurquoiseGrad)"
          stroke="url(#robotRingGrad)"
          strokeWidth="3.5"
        />

        {/* ── Robot Character ── */}
        <g id="robot-face">
          {/* Top Antenna */}
          {/* Stem */}
          <line
            x1="50"
            y1="38"
            x2="50"
            y2="30"
            stroke="#000000"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Antenna Ball */}
          <circle cx="50" cy="27" r="3.5" fill="#000000" />

          {/* Left Ear Module */}
          <rect
            x="27.5"
            y="43"
            width="5.5"
            height="14"
            rx="2.5"
            fill="none"
            stroke="#000000"
            strokeWidth="2.8"
          />
          <line
            x1="30.2"
            y1="46"
            x2="30.2"
            y2="54"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Right Ear Module */}
          <rect
            x="67"
            y="43"
            width="5.5"
            height="14"
            rx="2.5"
            fill="none"
            stroke="#000000"
            strokeWidth="2.8"
          />
          <line
            x1="69.8"
            y1="46"
            x2="69.8"
            y2="54"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Head Body (Squircle) */}
          <rect
            x="32.5"
            y="37"
            width="35"
            height="29"
            rx="9"
            fill="url(#robotTurquoiseGrad)"
            stroke="#000000"
            strokeWidth="3.2"
          />

          {/* Eyes (Solid Black Circles) */}
          <circle cx="43" cy="48.5" r="4.2" fill="#000000" />
          <circle cx="57" cy="48.5" r="4.2" fill="#000000" />

          {/* Cheeks (Subtle Dark Teal/Rosy Spots) */}
          <circle cx="39" cy="53" r="2.8" fill="#042f2e" opacity="0.25" />
          <circle cx="61" cy="53" r="2.8" fill="#042f2e" opacity="0.25" />

          {/* Mouth (Cute Curved Smile) */}
          <path
            d="M 44.5 56.5 Q 50 61.5 55.5 56.5"
            stroke="#000000"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
};

