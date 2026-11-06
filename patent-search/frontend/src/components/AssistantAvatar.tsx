import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface AssistantAvatarProps {
  size?: number | string;
  className?: string;
  animate?: boolean;
  interactive?: boolean;
  isClicked?: boolean;
}

export const AssistantAvatar: React.FC<AssistantAvatarProps> = ({
  size = 32,
  className = '',
  animate = false,
  interactive = false,
  isClicked = false,
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const [isBlinking, setIsBlinking] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);
  const [antennaPulse, setAntennaPulse] = useState(0);
  const [isHappy, setIsHappy] = useState(false);

  // Natural organic eye-blinking rhythm (double-blink micro-patterns)
  useEffect(() => {
    if (!animate || prefersReducedMotion) return;

    let blinkTimer: number;
    let isCancelled = false;

    const scheduleNextBlink = () => {
      if (isCancelled) return;
      const delay = 3200 + Math.random() * 2400;
      blinkTimer = window.setTimeout(() => {
        setIsBlinking(true);
        window.setTimeout(() => {
          setIsBlinking(false);
          // 40% chance of a quick, natural secondary blink
          if (Math.random() < 0.4) {
            window.setTimeout(() => {
              setIsBlinking(true);
              window.setTimeout(() => {
                setIsBlinking(false);
                scheduleNextBlink();
              }, 110);
            }, 130);
          } else {
            scheduleNextBlink();
          }
        }, 130);
      }, delay);
    };

    scheduleNextBlink();
    return () => {
      isCancelled = true;
      window.clearTimeout(blinkTimer);
    };
  }, [animate, prefersReducedMotion]);

  // Pointer / cursor tracking for interactive floating button (inspired by AlgoInsight)
  useEffect(() => {
    if (!interactive || prefersReducedMotion) return;

    let idleResetTimer: number;

    const handlePointer = (e: PointerEvent) => {
      const el = svgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      setLook({ x: nx * 2.2, y: ny * 1.6 });

      const winW = Math.max(window.innerWidth, 1);
      setTilt(Math.max(-8, Math.min(8, (dx / winW) * 16)));

      window.clearTimeout(idleResetTimer);
      idleResetTimer = window.setTimeout(() => {
        setLook({ x: 0, y: 0 });
        setTilt(0);
      }, 2400);
    };

    window.addEventListener('pointermove', handlePointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointer);
      window.clearTimeout(idleResetTimer);
    };
  }, [interactive, prefersReducedMotion]);

  // Tactile click response: antenna radio pulse & happy smile
  useEffect(() => {
    if (isClicked) {
      setAntennaPulse((p) => p + 1);
      setIsHappy(true);
      const timer = window.setTimeout(() => setIsHappy(false), 900);
      return () => window.clearTimeout(timer);
    }
  }, [isClicked]);

  return (
    <div
      style={{ width: pixelSize, height: pixelSize }}
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 group ${
        animate ? 'hover:scale-105 transition-transform duration-300' : ''
      } ${className}`}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full rounded-full transition-all duration-300 overflow-visible"
        style={{
          filter: animate
            ? 'drop-shadow(0 0 10px rgba(45, 212, 191, 0.75)) drop-shadow(0 0 20px rgba(6, 182, 212, 0.45))'
            : 'drop-shadow(0 0 6px rgba(45, 212, 191, 0.5))',
        }}
      >
        <defs>
          {/* Authentic Turquoise Gradient from original reference */}
          <linearGradient id="robotTurquoiseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="55%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>

          {/* Neon outer rim gradient */}
          <linearGradient id="robotRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="50%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Orbital Neon Ring Gradient */}
          <linearGradient id="robotOrbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
          </linearGradient>

          {/* Internal subtle turquoise ambient pulse */}
          <radialGradient id="internalTurquoisePulse" cx="50%" cy="38%" r="58%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="45%" stopColor="#5eead4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Circular Turquoise Background */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="url(#robotTurquoiseGrad)"
          stroke="url(#robotRingGrad)"
          strokeWidth="3.2"
        />

        {/* Internal Turquoise Light Glow Effect */}
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="url(#internalTurquoisePulse)"
          className={animate && !prefersReducedMotion ? 'animate-robot-internal-glow' : ''}
          pointerEvents="none"
        />

        {/* Thin Rotating Neon Orbital Ring */}
        {animate && !prefersReducedMotion && (
          <circle
            cx="50"
            cy="50"
            r="48.5"
            fill="none"
            stroke="url(#robotOrbitGrad)"
            strokeWidth="1.4"
            strokeDasharray="22 14 44 14"
            strokeLinecap="round"
            className="animate-robot-orbit"
          />
        )}

        {/* ── Robot Character Symbol (Strictly Unchanged Dimensions & Geometry) ── */}
        <motion.g
          id="robot-face"
          style={{ transformOrigin: '50px 50px', transformBox: 'fill-box' }}
          animate={animate && !prefersReducedMotion ? { rotate: tilt } : { rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        >
          {/* Top Antenna */}
          <line
            x1="50"
            y1="38"
            x2="50"
            y2="30"
            stroke="#000000"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* Antenna Bulb with Pulse Glow */}
          <motion.circle
            cx="50"
            cy="27"
            r="3.5"
            fill="#000000"
            style={{ transformOrigin: '50px 27px', transformBox: 'fill-box' }}
            animate={
              animate && !prefersReducedMotion
                ? {
                    scale: isHappy ? [1, 1.35, 1] : [0.95, 1.15, 0.95],
                    opacity: [0.85, 1, 0.85],
                  }
                : {}
            }
            transition={{
              duration: isHappy ? 0.6 : 2.2,
              repeat: isHappy ? 0 : Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Antenna Radio Signal Wave Ripple on Click / Happy */}
          <AnimatePresence>
            {antennaPulse > 0 && !prefersReducedMotion && (
              <motion.circle
                key={`ant-ripple-${antennaPulse}`}
                cx="50"
                cy="27"
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="1.6"
                initial={{ r: 3.5, opacity: 0.95 }}
                animate={{ r: 16, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

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
          <motion.line
            x1="30.2"
            y1="46"
            x2="30.2"
            y2="54"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            animate={
              animate && !prefersReducedMotion
                ? { opacity: [0.35, 1, 0.35] }
                : { opacity: 0.85 }
            }
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
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
          <motion.line
            x1="69.8"
            y1="46"
            x2="69.8"
            y2="54"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            animate={
              animate && !prefersReducedMotion
                ? { opacity: [0.35, 1, 0.35] }
                : { opacity: 0.85 }
            }
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.35, ease: 'easeInOut' }}
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

          {/* Eyes with Natural Occasional Blinking & Gaze Tracking */}
          <motion.g
            style={{ transformOrigin: '50px 48.5px', transformBox: 'fill-box' }}
            animate={
              prefersReducedMotion || !animate
                ? { scaleY: 1, x: 0, y: 0 }
                : isBlinking
                ? { scaleY: 0.08, x: look.x * 0.4, y: look.y * 0.4 }
                : { scaleY: 1, x: look.x, y: look.y }
            }
            transition={
              isBlinking
                ? { duration: 0.12, ease: 'easeInOut' }
                : { type: 'spring', stiffness: 220, damping: 16 }
            }
          >
            <circle cx="43" cy="48.5" r="4.2" fill="#000000" />
            <circle cx="57" cy="48.5" r="4.2" fill="#000000" />
          </motion.g>

          {/* Cheeks (Subtle Dark Teal Rosy Spots from reference) */}
          <motion.circle
            cx="39"
            cy="53"
            r="2.8"
            fill="#042f2e"
            animate={{ opacity: isHappy ? 0.45 : 0.25 }}
            transition={{ duration: 0.25 }}
          />
          <motion.circle
            cx="61"
            cy="53"
            r="2.8"
            fill="#042f2e"
            animate={{ opacity: isHappy ? 0.45 : 0.25 }}
            transition={{ duration: 0.25 }}
          />

          {/* Mouth (Cute Curved Smile with Happy Smile Reaction) */}
          <motion.path
            d={isHappy ? 'M 44 56 Q 50 63 56 56' : 'M 44.5 56.5 Q 50 61.5 55.5 56.5'}
            stroke="#000000"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          />
        </motion.g>
      </svg>
    </div>
  );
};
