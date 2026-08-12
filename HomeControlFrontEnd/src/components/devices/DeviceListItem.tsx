import { ListGroup, Badge } from 'react-bootstrap';
import type { DeviceSummary } from '../../services/devicesApi';

interface DeviceListItemProps {
  device: DeviceSummary;
  onSelect: (id: string) => void;
}

function DeviceListItem({ device, onSelect }: DeviceListItemProps) {
  return (
    <ListGroup.Item
      action
      onClick={() => onSelect(device.id)}
      className="d-flex justify-content-between align-items-center"
    >
      <span>{device.name}</span>
      <Badge bg="secondary">{device.type}</Badge>
    </ListGroup.Item>
  );
}

export default DeviceListItem;
