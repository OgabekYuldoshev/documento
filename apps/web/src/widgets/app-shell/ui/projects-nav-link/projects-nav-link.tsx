import { ActionIcon, NavLink, Tooltip } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { NavLink as RouterLink } from "react-router";
import { CreateProjectButton } from "@/features/projects/create-project";
import classes from "./projects-nav-link.module.scss";

type Props = {
  to: string;
  label: ReactNode;
  leftSection: ReactNode;
  onNavigate: () => void;
};

/** "Project'lar" nav item with a hover "+" on the right that creates a project. */
export function ProjectsNavLink({ to, label, leftSection, onNavigate }: Props) {
  return (
    <div className={classes.root}>
      <NavLink
        component={RouterLink}
        to={to}
        end
        label={label}
        leftSection={leftSection}
        onClick={onNavigate}
      />
      <CreateProjectButton
        renderTrigger={(open) => (
          <Tooltip label="Yangi project" openDelay={300}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              className={classes.add}
              aria-label="Yangi project"
              onClick={() => {
                onNavigate();
                open();
              }}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      />
    </div>
  );
}
