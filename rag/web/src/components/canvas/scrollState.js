/**
 * Shared mutable scroll state — updated by GSAP ScrollTrigger in LandingPage,
 * read every frame by R3F components via useFrame. Using a plain object avoids
 * React re-renders on every scroll event.
 */
export const scrollState = {
  /** 0 → 1 scroll progress across the whole landing page */
  progress: 0,
  /** Set to true once when scroll passes ~0.93 */
  splashFired: false,
  /** clock.elapsedTime value at the moment of splash, −1 if not yet fired */
  splashTime: -1,
}
