import { IconLayoutDashboard, IconUsers } from "@tabler/icons-react";
import type { ComponentType } from "react";
import { ROUTES } from "@/shared/config";

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; stroke?: number }>;
  adminOnly?: boolean;
};

export type NavGroup = {
  /** Section caption; omit for the top, unlabeled group. */
  title?: string;
  items: NavItem[];
};

/** Single source of truth for the sidebar and the ⌘K search. Add new pages here. */
export const NAVIGATION: NavGroup[] = [
  {
    items: [{ to: ROUTES.dashboard, label: "Dashboard", icon: IconLayoutDashboard }],
  },
  {
    title: "Administration",
    items: [{ to: ROUTES.users, label: "Users", icon: IconUsers, adminOnly: true }],
  },
];

export const getVisibleNavigation = (isAdmin: boolean): NavGroup[] =>
  NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0);
