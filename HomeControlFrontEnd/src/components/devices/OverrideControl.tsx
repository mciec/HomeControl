import { Alert, Button } from 'react-bootstrap';
import type { CurrentAnimation, OverrideDirection } from '../../services/devicesApi';
import AnimationProgressBar from './AnimationProgressBar';
import { ArrowLeftIcon, ArrowRightIcon } from '../icons/Icons';

interface OverrideControlProps {
  direction: OverrideDirection;
  currentAnimation: CurrentAnimation | null;
  loading: boolean;
  error: string | null;
  onOverride: () => void;
}

// Renders one direction's override control: a plain button while idle, or
// - for as long as this direction is the one currently animating - a live
// progress bar in its place. Keyed on startedAtUtc so a new animation (e.g.
// an override arriving mid-animation) remounts the bar with a fresh countdown
// instead of blending with stale timer state.
function OverrideControl({ direction, currentAnimation, loading, error, onOverride }: OverrideControlProps) {
  return (
    <>
      {currentAnimation && currentAnimation.direction === direction ? (
        <AnimationProgressBar
          key={currentAnimation.startedAtUtc}
          animationName={currentAnimation.animationName}
          direction={currentAnimation.direction}
          source={currentAnimation.source}
          startedAtUtc={currentAnimation.startedAtUtc}
          endsAtUtc={currentAnimation.endsAtUtc}
        />
      ) : (
        <Button variant="primary" className="override-btn" disabled={loading} onClick={onOverride}>
          {direction === 'Left' && !loading && <ArrowLeftIcon size={18} />}
          {loading ? 'Sending...' : `Override ${direction}`}
          {direction === 'Right' && !loading && <ArrowRightIcon size={18} />}
        </Button>
      )}
      {error && (
        <Alert variant="danger" className="mt-2 mb-0">
          {error}
        </Alert>
      )}
    </>
  );
}

export default OverrideControl;
