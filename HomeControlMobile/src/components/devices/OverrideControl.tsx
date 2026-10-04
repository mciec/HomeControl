import { StyleSheet, View } from 'react-native';
import type { CurrentAnimation, OverrideDirection } from '../../services/devicesApi';
import AnimationProgressBar from './AnimationProgressBar';
import Button from '../Button';
import { ErrorBox } from '../ui';
import { ArrowLeftIcon, ArrowRightIcon } from '../icons/Icons';
import { colors } from '../../theme';

interface OverrideControlProps {
  direction: OverrideDirection;
  currentAnimation: CurrentAnimation | null;
  loading: boolean;
  error: string | null;
  onOverride: () => void;
}

// Renders one direction's override control: a plain button while idle, or -
// for as long as this direction is the one currently animating - a live
// progress bar in its place. Keyed on startedAtUtc so a new animation (e.g.
// an override arriving mid-animation) remounts the bar with a fresh countdown
// instead of blending with stale timer state.
function OverrideControl({ direction, currentAnimation, loading, error, onOverride }: OverrideControlProps) {
  const icon = direction === 'Left' ? <ArrowLeftIcon size={18} color={colors.onAccent} /> : <ArrowRightIcon size={18} color={colors.onAccent} />;

  return (
    <View style={styles.wrapper}>
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
        <Button
          label={loading ? 'Sending...' : `Override ${direction}`}
          onPress={onOverride}
          loading={false}
          disabled={loading}
          iconLeft={direction === 'Left' && !loading ? icon : undefined}
          iconRight={direction === 'Right' && !loading ? icon : undefined}
        />
      )}
      {error && <ErrorBox message={error} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
});

export default OverrideControl;
