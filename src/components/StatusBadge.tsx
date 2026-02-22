import { Badge } from '@/components/ui/badge';

type Status = 'pending' | 'replied' | 'acknowledged';

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-warning/15 text-warning border-warning/30' },
  replied: { label: 'Replied', className: 'bg-info/15 text-info border-info/30' },
  acknowledged: { label: 'Acknowledged', className: 'bg-success/15 text-success border-success/30' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status as Status] || statusConfig.pending;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
};

export default StatusBadge;
