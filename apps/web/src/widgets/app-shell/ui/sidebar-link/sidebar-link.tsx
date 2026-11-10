import type { ReactNode } from "react";
import { NavLink } from "react-router";
import classes from "./sidebar-link.module.scss";

type Props = {
  to: string;
  label: string;
  icon: ReactNode;
  /** `sm` rows are used inside trees (project sections, recent templates). */
  size?: "md" | "sm";
  /** Route-match `end` behavior. */
  end?: boolean;
  /** Overrides route matching (e.g. when the state lives in the query string). */
  active?: boolean;
  /** Small dimmed text on the right (e.g. the project of a template). */
  hint?: string;
  /** Leave room on the right for an overlaid control. */
  reserveRight?: boolean;
  onNavigate?: () => void;
};

/** The single link/row primitive of the sidebar. */
export function SidebarLink({
  to,
  label,
  icon,
  size = "md",
  end,
  active,
  hint,
  reserveRight,
  onNavigate,
}: Props) {
  return (
    <NavLink
      to={to}
      end={end}
      title={hint ? `${label} · ${hint}` : undefined}
      onClick={onNavigate}
      data-size={size}
      className={({ isActive }) =>
        (active ?? isActive) ? `${classes.link} ${classes.active}` : classes.link
      }
      style={reserveRight ? { paddingRight: 36 } : undefined}
    >
      <span className={classes.icon}>{icon}</span>
      <span className={classes.label}>{label}</span>
      {hint && <span className={classes.hint}>{hint}</span>}
    </NavLink>
  );
}

type ActionProps = {
  label: string;
  icon: ReactNode;
  size?: "md" | "sm";
  onClick: () => void;
};

/** Sidebar row that runs an action (e.g. opens a dialog) instead of navigating. */
export function SidebarAction({ label, icon, size = "sm", onClick }: ActionProps) {
  return (
    <button type="button" className={classes.link} data-size={size} onClick={onClick}>
      <span className={classes.icon}>{icon}</span>
      <span className={classes.label}>{label}</span>
    </button>
  );
}
