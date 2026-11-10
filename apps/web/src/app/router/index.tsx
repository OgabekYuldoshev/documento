import { createBrowserRouter, RouterProvider } from "react-router";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { NotFoundPage } from "@/pages/not-found";
import { ProjectPage } from "@/pages/project";
import { ProjectsPage } from "@/pages/projects";
import { TemplatePage } from "@/pages/template";
import { UsersPage } from "@/pages/users";
import { ROUTES } from "@/shared/config";
import { AppShell } from "@/widgets/app-shell";
import { EditorShell } from "@/widgets/editor-shell";
import { requireAdmin, requireAuth, requireGuest } from "./guards";

const router = createBrowserRouter([
  { path: ROUTES.login, loader: requireGuest, element: <LoginPage /> },
  {
    // Full-screen editor: its own layout, no app sidebar.
    loader: requireAuth,
    element: <EditorShell />,
    children: [{ path: ROUTES.template(":projectId", ":templateId"), element: <TemplatePage /> }],
  },
  {
    loader: requireAuth,
    element: <AppShell />,
    children: [
      { path: ROUTES.dashboard, element: <DashboardPage /> },
      { path: ROUTES.users, loader: requireAdmin, element: <UsersPage /> },
      { path: ROUTES.projects, element: <ProjectsPage /> },
      { path: ROUTES.project(":projectId"), element: <ProjectPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
