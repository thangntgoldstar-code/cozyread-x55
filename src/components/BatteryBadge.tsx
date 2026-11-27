import React from 'react';
import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
} from 'lucide-react';

interface BatteryBadgeProps {
  level: number;
  charging: boolean;
  iconClassName?: string;
}

export const BatteryBadge: React.FC<BatteryBadgeProps> = ({
  level,
  charging,
  iconClassName = 'h-3.5 w-3.5',
}) => {
  const safeLevel = Math.max(0, Math.min(100, Math.round(level)));

  const colorClass = charging
    ? 'text-sky-300'
    : safeLevel <= 15
      ? 'text-rose-400'
      : safeLevel <= 30
        ? 'text-amber-300'
        : 'text-emerald-300';

  const renderIcon = () => {
    if (charging) {
      return <BatteryCharging className={iconClassName} />;
    }
    if (safeLevel <= 15) {
      return <BatteryWarning className={`${iconClassName} animate-pulse`} />;
    }
    if (safeLevel <= 30) {
      return <BatteryLow className={iconClassName} />;
    }
    if (safeLevel <= 74) {
      return <BatteryMedium className={iconClassName} />;
    }
    return <BatteryFull className={iconClassName} />;
  };

  return (
    <div
      className={`flex items-center gap-1 ${colorClass}`}
      title={
        charging
          ? `Đang sạc (${safeLevel}%)`
          : safeLevel <= 15
            ? `Pin sắp hết (${safeLevel}%)`
            : `Pin còn ${safeLevel}%`
      }
    >
      {renderIcon()}
      <span>{safeLevel}%</span>
    </div>
  );
};
