import { ListGroup } from 'react-bootstrap';
import type { DeviceSummary } from '../../services/devicesApi';
import { ChevronRightIcon, LedStripIcon } from '../icons/Icons';

interface DeviceListItemProps {
  device: DeviceSummary;
  onSelect: (id: string) => void;
}

function DeviceListItem({ device, onSelect }: DeviceListItemProps) {
  return (
    <ListGroup.Item
      action
      onClick={() => onSelect(device.id)}
      className="device-row d-flex align-items-center gap-3"
    >
      <span className="icon-tile">
        <LedStripIcon size={22} />
      </span>
      <span className="flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
        <strong className="d-block text-truncate">{device.name}</strong>
        <span className="type-pill">{device.type}</span>
      </span>
      <ChevronRightIcon className="device-row__chevron flex-shrink-0" />
    </ListGroup.Item>
  );
}

export default DeviceListItem;
