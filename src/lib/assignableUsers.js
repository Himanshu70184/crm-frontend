import { usersAPI, projectsAPI } from './api';

const ASSIGNABLE_ROLES = ['super_admin', 'admin', 'manager', 'team_member', 'member'];

/** Users who can be assigned to tasks (org-wide, merged with project team). */
export async function fetchAssignableUsers(projectId) {
  let orgUsers = [];
  try {
    const res = await usersAPI.getAll({ limit: 200 });
    orgUsers = (res.data.users || []).filter(
      (u) => u.isActive !== false && ASSIGNABLE_ROLES.includes(u.role)
    );
  } catch {
    orgUsers = [];
  }

  if (!projectId) {
    return orgUsers.sort((a, b) => a.name.localeCompare(b.name));
  }

  try {
    const pRes = await projectsAPI.getOne(projectId);
    const p = pRes.data.project;
    const map = new Map();
    orgUsers.forEach((u) => map.set(u._id, u));
    (p.team || []).forEach((m) => map.set(m._id, m));
    if (p.owner) {
      const owner = typeof p.owner === 'object' ? p.owner : { _id: p.owner };
      if (owner._id) map.set(owner._id, owner);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return orgUsers.sort((a, b) => a.name.localeCompare(b.name));
  }
}
