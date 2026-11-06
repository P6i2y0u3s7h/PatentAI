import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface HeroWordRevealProps {
  prefixText: string;
  gradientText: string;
  className?: string;
}

export const HeroWordReveal: React.FC<HeroWordRevealProps> = ({
  prefixText,
  gradientText,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  const prefixWords = prefixText.trim().split(/\s+/);
  const gradientWords = gradientText.trim().split(/\s+/);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.15,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 30,
      filter: shouldReduceMotion ? 'none' : 'blur(10px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: shouldReduceMotion ? 0.3 : 0.75,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <motion.h1
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {/* Prefix White Words */}
      <span className="inline">
        {prefixWords.map((word, idx) => (
          <motion.span
            key={`prefix-${idx}`}
            variants={wordVariants}
            className="inline-block mr-[0.28em] text-white"
          >
            {word}
          </motion.span>
        ))}
      </span>{' '}
      {/* Highlighted Animated Gradient Words */}
      <span className="inline-block animate-neural-gradient neural-gradient-glow font-extrabold">
        {gradientWords.map((word, idx) => (
          <motion.span
            key={`grad-${idx}`}
            variants={wordVariants}
            className="inline-block mr-[0.28em] last:mr-0"
          >
            {word}
          </motion.span>
        ))}
      </span>
    </motion.h1>
  );
};

interface ScrollRevealSectionProps {
  badge?: string;
  badgeIcon?: React.ReactNode;
  heading: string;
  highlightedWord?: string;
  description?: string;
  align?: 'center' | 'left';
  className?: string;
}

export const ScrollRevealSection: React.FC<ScrollRevealSectionProps> = ({
  badge,
  badgeIcon,
  heading,
  highlightedWord,
  description,
  align = 'center',
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.09,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 20,
      filter: shouldReduceMotion ? 'none' : 'blur(6px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: shouldReduceMotion ? 0.3 : 0.65,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const words = heading.split(' ');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className={`${align === 'center' ? 'text-center mx-auto' : 'text-left'} max-w-2xl ${className}`}
    >
      {badge && (
        <motion.div variants={itemVariants} className="inline-block mb-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B1020] border border-cyan-500/30 text-[11px] font-mono text-cyan-400 uppercase tracking-wider shadow-[0_0_12px_-3px_rgba(6,182,212,0.25)]">
            {badgeIcon}
            <span>{badge}</span>
          </div>
        </motion.div>
      )}

      <motion.h2
        variants={itemVariants}
        className="text-2xl sm:text-3xl lg:text-4xl font-bold font-heading text-white tracking-tight leading-tight"
      >
        {words.map((w, i) => {
          const isHighlighted = highlightedWord && w.toLowerCase().includes(highlightedWord.toLowerCase());
          return (
            <span
              key={i}
              className={`inline-block mr-[0.25em] ${
                isHighlighted ? 'animate-neural-gradient neural-gradient-glow font-extrabold' : ''
              }`}
            >
              {w}
            </span>
          );
        })}
      </motion.h2>

      {description && (
        <motion.p
          variants={itemVariants}
          className="text-sm sm:text-base text-slate-400 mt-2.5 leading-relaxed"
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
};

