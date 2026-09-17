/**
 * Motion tokens. Match Uber/Lyft cadence — fast but never instant.
 * Use `swift` for taps, `standard` for sheet/page transitions,
 * `expressive` for map camera + ride-state hero animations.
 */
export const motion = {
  duration: {
    instant: '0ms',
    swift: '120ms',
    quick: '180ms',
    standard: '240ms',
    relaxed: '320ms',
    expressive: '480ms',
    slow: '640ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;
