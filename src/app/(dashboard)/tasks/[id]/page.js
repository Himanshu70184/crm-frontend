'use client';

import { useParams, useRouter } from 'next/navigation';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  return (
    <TaskDetailModal
      taskId={id}
      open
      onClose={() => router.back()}
    />
  );
}
