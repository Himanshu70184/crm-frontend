'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PRIORITY_COLORS, formatDate } from '@/lib/utils';
import { getColumnStyle } from '@/lib/kanban';

export default function KanbanBoard({
  columns,
  tasks,
  onTasksChange,
  onMoveTask,
  showProject = true,
  onOpenTask,
}) {
  const [activeTask, setActiveTask] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const safeColumns = columns?.length ? columns : [];
  const columnIds = safeColumns.map((c) => c.id);

  const getColumnTasks = (colId) => {
    const filtered = tasks.filter((t) => {
      if (t.status === colId) return true;
      if (colId === safeColumns[0]?.id && !columnIds.includes(t.status)) return true;
      return false;
    });
    return filtered;
  };

  const resolveTargetStatus = (over) => {
    if (!over) return null;
    if (over.data?.current?.status) return over.data.current.status;
    if (columnIds.includes(over.id)) return over.id;
    const overTask = tasks.find((t) => t._id === over.id);
    if (overTask) return overTask.status;
    return null;
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over || !columns?.length) return;

    const task = tasks.find((t) => t._id === active.id);
    const targetStatus = resolveTargetStatus(over);
    if (!task || !targetStatus || task.status === targetStatus) return;
    if (!columnIds.includes(targetStatus)) return;

    const snapshot = [...tasks];
    onTasksChange(
      snapshot.map((item) => (item._id === task._id ? { ...item, status: targetStatus } : item))
    );
    try {
      await onMoveTask(task._id, targetStatus);
    } catch {
      onTasksChange(snapshot);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveTask(tasks.find((t) => t._id === active.id) || null)}
      onDragEnd={handleDragEnd}
    >
      {/*
        h-full instead of min-h-[calc(100vh-...)]:
        this makes the board fill EXACTLY the height its parent gives it
        (the fixed-height wrapper in TasksPage), never taller. That parent
        already owns the overflow-x-auto scrollbar, so this div must never
        grow past it or the scrollbar position becomes unstable.
      */}
      <div className="kanban-scroll flex gap-4 h-full pb-4 px-1 w-full">
        <div className="flex gap-4 min-w-max h-full">
          {safeColumns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={getColumnTasks(col.id)}
              showProject={showProject}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} showProject={showProject} dragging onOpenTask={onOpenTask} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ column, tasks, showProject, onOpenTask }) {
  const style = getColumnStyle(column.color);
  const atWip = column.wipLimit != null && tasks.length >= column.wipLimit;

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { status: column.id, type: 'column' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] flex-shrink-0 h-full flex flex-col rounded-2xl border transition-colors ${
        isOver ? 'border-primary-400 bg-primary-50/40' : atWip ? 'border-amber-300 bg-amber-50/30' : 'border-surface-200 bg-surface-50'
      }`}
    >
      <div className="p-3 flex items-center justify-between border-b border-surface-200/80 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.header}`} />
          <span className="font-semibold text-surface-800 text-sm truncate">{column.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${atWip ? 'bg-amber-200 text-amber-900' : 'bg-white text-surface-600'}`}>
            {tasks.length}
            {column.wipLimit != null ? ` / ${column.wipLimit}` : ''}
          </span>
        </div>
      </div>

      <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
        {/*
          flex-1 + min-h-0 is what makes THIS div (not the column, not the board)
          the one that scrolls vertically. min-h-0 is required — without it a
          flex child refuses to shrink below its content height, which is the
          classic reason "overflow-y-auto" silently does nothing in a flex column.
        */}
        <div className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task._id}
              task={task}
              columnId={column.id}
              showProject={showProject}
              onOpenTask={onOpenTask}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-center text-surface-400 text-xs py-8 border-2 border-dashed border-surface-200 rounded-xl">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, columnId, showProject, onOpenTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    data: { task, status: columnId },
  });
  const pointerStart = useRef(null);

  const handleClick = (e) => {
    if (!onOpenTask || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.hypot(dx, dy) < 8) onOpenTask(task._id);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        pointerStart.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e);
      }}
      onClick={handleClick}
    >
      <TaskCard task={task} showProject={showProject} dragging={isDragging} onOpenTask={onOpenTask} />
    </div>
  );
}

function TaskCard({ task, showProject, dragging, onOpenTask }) {
  const className = `block bg-white rounded-xl p-3.5 shadow-sm border border-surface-200 hover:border-primary-300 hover:shadow-md transition-all ${
    dragging ? 'rotate-1 shadow-lg ring-2 ring-primary-200' : ''
  } ${onOpenTask ? 'cursor-pointer' : ''}`;

  const inner = (
    <>
      {showProject && task.project?.name && (
        <p className="text-[10px] font-semibold text-primary-600 uppercase tracking-wide mb-1.5 truncate">
          {task.project.name}
        </p>
      )}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm font-medium text-surface-900 leading-snug line-clamp-3">{task.title}</p>
      {task.subtasks?.length > 0 && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-surface-400 mb-1">
            <span>Subtasks</span>
            <span>
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
            </span>
          </div>
          <div className="bg-surface-100 rounded-full h-1">
            <div
              className="h-1 rounded-full"
              style={{
                width: `${(task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100}%`,
                backgroundColor: 'var(--brand-primary)',
              }}
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-100">
        <span className={`badge text-[10px] ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
        <div className="flex items-center gap-2">
          {task.dueDate && <span className="text-[10px] text-surface-500">{formatDate(task.dueDate)}</span>}
          {task.assignee ? (
            <div
              className="w-6 h-6 rounded-lg text-white text-[10px] flex items-center justify-center font-bold"
              style={{ backgroundColor: 'var(--brand-primary)' }}
              title={task.assignee.name}
            >
              {task.assignee.name?.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-lg bg-surface-200 text-surface-400 text-[10px] flex items-center justify-center">?</div>
          )}
        </div>
      </div>
    </>
  );

  if (onOpenTask) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <Link href={`/tasks/${task._id}`} className={className} onClick={(e) => dragging && e.preventDefault()}>
      {inner}
    </Link>
  );
}