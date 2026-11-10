/**
 * Mirrors the API rule (`accessOf`): the owner and the superadmin manage a project (members,
 * ownership, archive, delete); everyone else with access is a plain member. UX only, the API
 * is the authority.
 */
export const canManageProject = (
  project: { ownerId: string },
  user: { id: string; role?: string | null } | undefined | null,
) => Boolean(user && (user.role === "superadmin" || project.ownerId === user.id));
