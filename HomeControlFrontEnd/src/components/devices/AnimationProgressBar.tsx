import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { ArrowLeftIcon, ArrowRightIcon } from '../icons/Icons';
import type { AnimationSource, OverrideDirection } from '../../services/devicesApi';

interface AnimationProgressBarProps {
  animationName: string;
  direction: OverrideDirection;
  source: AnimationSource;
  startedAtUtc: string;
  endsAtUtc: string;
}

const TICK_INTERVAL_MS = 200;

// Replaces an override button for the duration of its direction's animation.
// The fill is anchored to the side the animation travels away from, so a Left
// animation drains right-to-left (its trailing right edge recedes) and a
// Right animation drains left-to-right (mirrored) - matching the physical
// direction the LEDs move. The label sits in its own full-width layer on top
// of the fill so it stays fully readable no matter how far the bar has drained.
function AnimationProgressBar({ animationName, direction, source, startedAtUtc, endsAtUtc }: AnimationProgressBarProps) {
  const startTime = Date.parse(startedAtUtc);
  const endTime = Date.parse(endsAtUtc);

  // endsAtUtc is a server-time instant; count down against server time (local
  // clock + measured offset) so a skewed browser clock can't shift the bar.
  const clockOffsetMs = useSelector((state: RootState) => state.devices.serverClockOffsetMs);

  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endTime - (Date.now() + clockOffsetMs)));

  useEffect(() => {
    // Re-sync immediately in case props changed since the initial render.
    setRemainingMs(Math.max(0, endTime - (Date.now() + clockOffsetMs)));

    const intervalId = setInterval(() => {
      const next = Math.max(0, endTime - (Date.now() + clockOffsetMs));
      setRemainingMs(next);
      if (next === 0) {
        clearInterval(intervalId);
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAtUtc, endsAtUtc, clockOffsetMs]);

  const totalDurationMs = endTime - startTime;
  const percentRemaining =
    totalDurationMs > 0 ? Math.min(100, Math.max(0, (remainingMs / totalDurationMs) * 100)) : 0;
  const fillVariant = source === 'Override' ? 'override' : 'motion';
  const fillPosition = direction === 'Left' ? { left: 0 } : { right: 0 };

  return (
    <div className="override-bar btn p-0" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentRemaining)}>
      <div
        className={`override-bar__fill override-bar__fill--${fillVariant}`}
        style={{ ...fillPosition, width: `${percentRemaining}%` }}
      />
      {/* Own layer on top of the fill and the track behind it, so the label stays fully
          readable at any fill level instead of only where it overlaps the colored portion. */}
      <div className="override-bar__label">
        {direction === 'Left' && <ArrowLeftIcon size={18} />}
        <span className="text-truncate">
          {source === 'Override' ? 'Override' : 'Motion'} {direction} — {animationName}
        </span>
        {direction === 'Right' && <ArrowRightIcon size={18} />}
      </div>
    </div>
  );
}

export default AnimationProgressBar;
