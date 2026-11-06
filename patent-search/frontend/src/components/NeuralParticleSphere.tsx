import React, { useEffect, useRef, useState } from 'react';

interface Particle {
  x0: number;
  y0: number;
  z0: number;
  radiusOffset: number;
  phase: number;
  speed: number;
  baseSize: number;
  isCore: boolean;
  isOrbiter?: boolean;
}

export const NeuralParticleSphere: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let isTabVisible = true;
    let width = container.clientWidth || 550;
    let height = container.clientHeight || 550;

    // Handle high DPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Particle Configuration
    const isMobile = width < 640;
    const TOTAL_PARTICLES = isMobile ? 950 : 2200;
    const SPHERE_RADIUS = Math.min(width, height) * (isMobile ? 0.38 : 0.40);
    const FOCAL_LENGTH = 650;
    const CAMERA_DISTANCE = 750;

    // Generate Fibonacci Sphere Particles
    const particles: Particle[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle (~2.3999 rad)

    // 1. Surface Shell Particles
    const surfaceCount = Math.floor(TOTAL_PARTICLES * 0.78);
    for (let i = 0; i < surfaceCount; i++) {
      const y = 1 - (i / (surfaceCount - 1)) * 2; // from 1 to -1
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      particles.push({
        x0: x,
        y0: y,
        z0: z,
        radiusOffset: 0.94 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        baseSize: isMobile ? 1.4 + Math.random() * 1.4 : 1.6 + Math.random() * 1.8,
        isCore: false,
      });
    }

    // 2. Inner Neural Core Particles (Volume density)
    const coreCount = Math.floor(TOTAL_PARTICLES * 0.18);
    for (let i = 0; i < coreCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phiAngle = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 0.65; // Distributed in core

      const sinPhi = Math.sin(phiAngle);
      const x = r * sinPhi * Math.cos(theta);
      const y = r * Math.cos(phiAngle);
      const z = r * sinPhi * Math.sin(theta);

      particles.push({
        x0: x,
        y0: y,
        z0: z,
        radiusOffset: 1.0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        baseSize: 1.2 + Math.random() * 1.2,
        isCore: true,
      });
    }

    // 3. Orbiting Neural Stardust (Floating outer nodes)
    const orbitCount = Math.floor(TOTAL_PARTICLES * 0.04);
    for (let i = 0; i < orbitCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phiAngle = (Math.random() - 0.5) * Math.PI * 0.8;
      const r = 1.15 + Math.random() * 0.25;

      const x = r * Math.cos(phiAngle) * Math.cos(theta);
      const y = r * Math.sin(phiAngle);
      const z = r * Math.cos(phiAngle) * Math.sin(theta);

      particles.push({
        x0: x,
        y0: y,
        z0: z,
        radiusOffset: r,
        phase: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 0.8,
        baseSize: 1.8 + Math.random() * 1.6,
        isCore: false,
        isOrbiter: true,
      });
    }

    // Interactive mouse rotation tracking
    let targetRotationX = 0.05;
    let targetRotationY = 0;
    let rotationX = 0.05;
    let rotationY = 0;
    let time = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const mouseY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      targetRotationY = mouseX * 0.45;
      targetRotationX = -mouseY * 0.35;
    };

    const handleMouseLeave = () => {
      targetRotationX = 0.05;
      targetRotationY = 0;
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Visibility change handler to save resources
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && !prefersReducedMotion) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Color interpolation helper
    // Left: Cyan (#00f5ff / #06b6d4)
    // Center: Electric Blue (#3b82f6)
    // Right: Violet & Magenta (#a855f7 / #d946ef)
    const getParticleColor = (normX: number, alpha: number) => {
      // normX ranges approx -1 (left) to +1 (right)
      let r: number, g: number, b: number;

      if (normX < -0.15) {
        // Deep cyan to bright neon cyan
        const t = Math.min(1, Math.max(0, (normX + 1) / 0.85));
        // (-1): pure electric cyan rgb(0, 245, 255) -> (-0.15): teal-blue rgb(6, 182, 212)
        r = Math.round(0 * (1 - t) + 14 * t);
        g = Math.round(245 * (1 - t) + 185 * t);
        b = Math.round(255 * (1 - t) + 245 * t);
      } else if (normX <= 0.15) {
        // Cyan-Blue into Electric Blue rgb(59, 130, 246)
        const t = (normX + 0.15) / 0.3;
        r = Math.round(14 * (1 - t) + 59 * t);
        g = Math.round(185 * (1 - t) + 130 * t);
        b = Math.round(245 * (1 - t) + 246 * t);
      } else {
        // Electric Blue into Violet/Magenta rgb(217, 70, 239)
        const t = Math.min(1, Math.max(0, (normX - 0.15) / 0.85));
        r = Math.round(59 * (1 - t) + 225 * t);
        g = Math.round(130 * (1 - t) + 65 * t);
        b = Math.round(246 * (1 - t) + 235 * t);
      }

      return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    };

    let lastTime = performance.now();

    // Render Loop
    const render = (currentTime: number) => {
      if (!isTabVisible) return;

      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      if (!prefersReducedMotion) {
        time += delta * 0.85;
      }

      // Smooth camera rotation interpolation
      rotationX += (targetRotationX - rotationX) * 0.04;
      rotationY += (targetRotationY - rotationY) * 0.04;

      const autoSpin = prefersReducedMotion ? 0 : time * 0.22;
      const currentRotY = rotationY + autoSpin;
      const currentRotX = rotationX + Math.sin(time * 0.3) * 0.06;

      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);
      const cosX = Math.cos(currentRotX);
      const sinX = Math.sin(currentRotX);

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Project all particles
      interface ProjectedParticle {
        px: number;
        py: number;
        pz: number;
        size: number;
        alpha: number;
        color: string;
        normX: number;
      }

      const projected: ProjectedParticle[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Harmonic organic wave displacement
        let radius = SPHERE_RADIUS * p.radiusOffset;
        if (!p.isCore && !prefersReducedMotion) {
          const wave =
            Math.sin(p.y0 * 3.8 + time * 1.4 + p.phase) * 0.06 +
            Math.cos(p.x0 * 4.2 - time * 1.1 + p.phase) * 0.05 +
            Math.sin(p.z0 * 3.0 + time * 0.8) * 0.04;
          radius *= 1 + wave;
        }

        const px0 = p.x0 * radius;
        const py0 = p.y0 * radius;
        const pz0 = p.z0 * radius;

        // 3D Rotation Matrix
        // Rotate around Y
        const x1 = px0 * cosY + pz0 * sinY;
        const y1 = py0;
        const z1 = -px0 * sinY + pz0 * cosY;

        // Rotate around X
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // 3D Perspective Projection
        const distance = CAMERA_DISTANCE - z2;
        if (distance <= 10) continue;

        const projectionScale = FOCAL_LENGTH / distance;
        const screenX = centerX + x2 * projectionScale;
        const screenY = centerY + y2 * projectionScale;

        // Depth-based size and opacity
        const depthFactor = (z2 + SPHERE_RADIUS) / (SPHERE_RADIUS * 2); // 0 (back) to 1 (front)
        const alpha = p.isCore
          ? 0.15 + depthFactor * 0.45
          : p.isOrbiter
          ? 0.45 + depthFactor * 0.55
          : 0.22 + depthFactor * 0.78;

        const size = Math.max(0.7, p.baseSize * projectionScale * (0.8 + depthFactor * 0.6));
        const normX = x2 / (SPHERE_RADIUS * 1.1);

        projected.push({
          px: screenX,
          py: screenY,
          pz: z2,
          size,
          alpha,
          color: getParticleColor(normX, alpha),
          normX,
        });
      }

      // Sort by depth (furthest to nearest)
      projected.sort((a, b) => a.pz - b.pz);

      // Additive blending for luminous glow
      ctx.globalCompositeOperation = 'lighter';

      // Draw subtle connecting neural mesh lines between close front particles
      const MESH_CONNECT_DIST = isMobile ? 32 : 44;
      const frontParticles = projected.filter((p) => p.pz > 0 && Math.random() < 0.28);
      ctx.lineWidth = 0.6;
      for (let i = 0; i < frontParticles.length; i++) {
        for (let j = i + 1; j < Math.min(i + 5, frontParticles.length); j++) {
          const dx = frontParticles[i].px - frontParticles[j].px;
          const dy = frontParticles[i].py - frontParticles[j].py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MESH_CONNECT_DIST) {
            const lineAlpha = (1 - dist / MESH_CONNECT_DIST) * 0.18;
            ctx.strokeStyle = `rgba(59, 130, 246, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(frontParticles[i].px, frontParticles[i].py);
            ctx.lineTo(frontParticles[j].px, frontParticles[j].py);
            ctx.stroke();
          }
        }
      }

      // Draw Particles
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];

        // Soft outer glow for front prominent particles
        if (pt.pz > SPHERE_RADIUS * 0.2 && pt.size > 2.0) {
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, pt.size * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = pt.color.replace(/[\d\.]+\)$/, `${pt.alpha * 0.22})`);
          ctx.fill();
        }

        // Core sharp particle
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.round(entry.contentRect.width);
        const newHeight = Math.round(entry.contentRect.height);
        if (newWidth > 0 && newHeight > 0 && (newWidth !== width || newHeight !== height)) {
          width = newWidth;
          height = newHeight;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full h-[450px] sm:h-[520px] lg:h-[600px] flex items-center justify-center select-none ${className}`}
    >
      {/* Cinematic Ambient Lighting Orbs behind the sphere */}
      {/* Cyan glow on the left */}
      <div
        className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full pointer-events-none transition-all duration-700"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(6, 182, 212, 0.05) 45%, transparent 70%)',
          filter: 'blur(55px)',
          transform: isHovered ? 'translate(-50%, -50%) scale(1.15)' : 'translate(-50%, -50%) scale(1.0)',
        }}
      />

      {/* Electric Blue glow in center */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(37, 99, 235, 0.06) 50%, transparent 75%)',
          filter: 'blur(65px)',
        }}
      />

      {/* Violet/Magenta glow on the right */}
      <div
        className="absolute right-1/4 top-1/2 translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full pointer-events-none transition-all duration-700"
        style={{
          background: 'radial-gradient(circle, rgba(217, 70, 239, 0.20) 0%, rgba(168, 85, 247, 0.05) 45%, transparent 70%)',
          filter: 'blur(55px)',
          transform: isHovered ? 'translate(50%, -50%) scale(1.15)' : 'translate(50%, -50%) scale(1.0)',
        }}
      />

      {/* 3D Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="relative z-10 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Subtle Bottom Ground Reflection */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-8 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.15) 0%, rgba(168, 85, 247, 0.08) 40%, transparent 70%)',
          filter: 'blur(16px)',
        }}
      />
    </div>
  );
};

