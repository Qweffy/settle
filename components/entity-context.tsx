'use client';
import { createContext, useContext } from 'react';
import type { Entity } from '@/lib/data/shell';

const EntityContext = createContext<Entity | null>(null);

export function EntityProvider({ entity, children }: { entity: Entity; children: React.ReactNode }) {
  return <EntityContext.Provider value={entity}>{children}</EntityContext.Provider>;
}

export function useActiveEntity(): Entity {
  const e = useContext(EntityContext);
  if (!e) throw new Error('useActiveEntity must be used within EntityProvider');
  return e;
}
