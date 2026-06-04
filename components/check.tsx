'use client';

import { Icon } from '@/components/icon';

export type CheckState = 'on' | 'off' | 'partial';

// Tri-state row checkbox shared by the bills + approvals tables.
export function Check({ state, onClick }: { state: CheckState; onClick: () => void }) {
  return (
    <span
      className={'cbox' + (state === 'on' ? ' on' : state === 'partial' ? ' partial' : '')}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name={state === 'partial' ? 'minus' : 'check'} size={12} />
    </span>
  );
}
