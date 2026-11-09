export const ROUTES = {
  login: "/login",
  dashboard: "/",
  users: "/users",
  projects: "/projects",
  project: (id: string) => `/projects/${id}`,
} as const;
