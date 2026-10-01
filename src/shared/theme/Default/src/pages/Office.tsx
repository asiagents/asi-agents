import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, PageScroll } from '../components/PageScroll';
import { TeamGate } from '../components/TeamGate';
import { PanicButton } from '../components/chat/PanicButton';
import { OfficeFloor } from '../components/office/OfficeFloor';
import { HierarchyTree } from '../components/office/HierarchyTree';
import { useDesk } from '../contexts/DeskContext';

type Tab = 'live' | 'hierarchy';

const tabs: {id: Tab;label: string;}[] = [
{ id: 'live', label: 'Live' },
{ id: 'hierarchy', label: 'Hierarchy' }];


export function Office() {
  const { isTeamMode } = useDesk();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'hierarchy' ? 'hierarchy' : 'live';

  if (!isTeamMode) {
    return (
      <TeamGate
        feature="The Office"
        description="Watch agents work on the live floor and rearrange who reports to whom. Super Agent keeps things to one thread." />);


  }

  return (
    <PageScroll>
      <PageHeader
        title="Office"
        description={tab === 'live' ? 'Everyone at their desk, what they are doing, and which model they are on.' : 'Your org tree. Drag to reparent or reorder.'}
        actions={
        <div className="flex items-center gap-3">
            <div role="tablist" aria-label="Office view" className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
              {tabs.map((t) =>
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setParams({ tab: t.id })}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
              tab === t.id ? 'bg-accent/15 text-accent-ink' : 'text-muted hover:text-ink'}`
              }>
              
                  {t.label}
                </button>
            )}
            </div>
            <PanicButton />
          </div>
        } />
      
      {tab === 'live' ? <OfficeFloor /> : <HierarchyTree />}
    </PageScroll>);

}