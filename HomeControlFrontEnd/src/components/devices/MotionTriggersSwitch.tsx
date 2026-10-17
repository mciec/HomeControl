import { Alert, Form } from 'react-bootstrap';

interface MotionTriggersSwitchProps {
  // null = the device hasn't reported its state yet.
  enabled: boolean | null;
  // True from the moment a change is requested until the device confirms it.
  pending: boolean;
  error: string | null;
  onChange: (enabled: boolean) => void;
}

// Switch for whether the motion detectors may start animations. When off, animations
// only run via the manual override buttons. Always shows the device's reported state.
function MotionTriggersSwitch({ enabled, pending, error, onChange }: MotionTriggersSwitchProps) {
  const status = enabled === null ? 'Waiting for device...' : pending ? 'Updating...' : enabled ? 'On' : 'Off';

  return (
    <>
      <div className="motion-switch">
        <Form.Check
          type="switch"
          id="motion-triggers-switch"
          label="Motion detectors"
          checked={enabled ?? false}
          disabled={enabled === null || pending}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="motion-switch__status" data-on={enabled === true && !pending}>
          {status}
        </span>
      </div>
      <div className="text-muted small mt-1">
        {enabled === false ? 'Animations run only via manual override.' : 'Animations start when motion is detected.'}
      </div>
      {error && (
        <Alert variant="danger" className="mt-2 mb-0">
          {error}
        </Alert>
      )}
    </>
  );
}

export default MotionTriggersSwitch;
