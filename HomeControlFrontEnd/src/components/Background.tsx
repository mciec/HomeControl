// Fixed, non-interactive backdrop behind the whole app: a deep-navy gradient, slowly drifting
// colour orbs, a faint dot grid and a colour-shifting "LED strip" line along the bottom edge.
// Pure CSS (see .app-background in App.css); animations are disabled under
// prefers-reduced-motion.
function Background() {
  return (
    <div className="app-background" aria-hidden="true">
      <div className="app-background__orb app-background__orb--a" />
      <div className="app-background__orb app-background__orb--b" />
      <div className="app-background__strip" />
    </div>
  );
}

export default Background;
