import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly animates a numeric value from its previous state to its target state
 * using an ease-out cubic animation curve.
 */
export function useAnimatedNumber(target: number, durationMs: number = 450): number {
  const [displayValue, setDisplayValue] = useState<number>(target);
  const startRef = useRef<number>(target);
  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = startRef.current;
    if (startVal === target) {
      setDisplayValue(target);
      return;
    }

    startTimeRef.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (target - startVal) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        startRef.current = target;
        setDisplayValue(target);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [target, durationMs]);

  return displayValue;
}

