export const ROUTES = {
  login: "/login",
  dashboard: "/",
  users: "/users",
  profile: "/profile",
  projects: "/projects",
  project: (id: string) => `/projects/${id}`,
  template: (projectId: string, templateId: string) =>
    `/projects/${projectId}/templates/${templateId}`,
} as const;
