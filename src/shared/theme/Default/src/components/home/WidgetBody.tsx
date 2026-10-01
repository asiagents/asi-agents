import React from 'react';
import { AgentsWidget, ApprovalsWidget, ModelWidget, NextUpWidget, SpendWidget } from './widgets/StatusWidgets';
import { CalendarWidget, HardwareWidget, NetWidget, TimeWidget, WeatherWidget } from './widgets/InfoWidgets';
import { PanicWidget, VdWidget } from './widgets/ActionWidgets';
import { NeuralBrainWidget } from './widgets/NeuralBrainWidget';
import { TodosWidget } from '../../todo/TodosWidget';
import { RunActivityWidget, TaskOutcomesWidget, TasksStatusWidget } from './widgets/MetricWidgets';
import type { WidgetInstance } from '../../types/settings';

export function WidgetBody({ widget }: {widget: WidgetInstance;}) {
  const { size } = widget;
  switch (widget.type) {
    case 'agents':return <AgentsWidget size={size} />;
    case 'run-activity':return <RunActivityWidget size={size} />;
    case 'tasks-status':return <TasksStatusWidget size={size} />;
    case 'task-outcomes':return <TaskOutcomesWidget size={size} />;
    case 'approvals':return <ApprovalsWidget size={size} />;
    case 'nextup':return <NextUpWidget size={size} />;
    case 'model':return <ModelWidget />;
    case 'spend':return <SpendWidget size={size} />;
    case 'time':return <TimeWidget size={size} />;
    case 'weather':return <WeatherWidget size={size} />;
    case 'net':return <NetWidget />;
    case 'hardware':return <HardwareWidget size={size} />;
    case 'calendar':return <CalendarWidget size={size} />;
    case 'todos':return <TodosWidget size={size} />;
    case 'panic':return <PanicWidget />;
    case 'vd':return <VdWidget size={size} />;
    case 'neural-brain':return <NeuralBrainWidget size={size} />;
    default:return null;
  }
}