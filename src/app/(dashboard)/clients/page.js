'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usersAPI, projectsAPI } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { ROLE_COLORS, PROJECT_STATUS_COLORS, formatDate } from '@/lib/utils';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      usersAPI.getAll({ role: 'client' }),
      projectsAPI.getAll({ limit: 100 }),
    ])
      .then(([uRes, pRes]) => {
        setClients(uRes.data.users || []);
        setProjects(pRes.data.projects || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const projectsForClient = (email) =>
    projects.filter((p) => p.client?.email === email);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Client accounts and linked projects for your service organization"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clients.length ? clients.map((client) => {
          const linked = projectsForClient(client.email);
          return (
            <div key={client._id} className="card-hover p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                  {client.name?.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-surface-900 truncate">{client.name}</h3>
                  <p className="text-sm text-surface-500 truncate">{client.email}</p>
                  <span className={`badge mt-2 ${ROLE_COLORS.client}`}>Client</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-surface-100">
                <p className="text-xs font-semibold text-surface-500 uppercase mb-2">
                  Projects ({linked.length})
                </p>
                {linked.length ? (
                  <ul className="space-y-2">
                    {linked.map((p) => (
                      <li key={p._id}>
                        <Link href={`/projects/${p._id}`} className="flex items-center justify-between text-sm hover:text-primary-600 group">
                          <span className="font-medium text-surface-800 group-hover:text-primary-700 truncate">{p.name}</span>
                          <span className={`badge ml-2 ${PROJECT_STATUS_COLORS[p.status]}`}>{p.status}</span>
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-xs text-surface-400">{p.progress}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-surface-400">No linked projects</p>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full card p-12 text-center text-surface-500">
            No client users yet. Register users with the Client role or run <code className="text-primary-600">npm run seed</code> in backend.
          </div>
        )}
      </div>
    </div>
  );
}
