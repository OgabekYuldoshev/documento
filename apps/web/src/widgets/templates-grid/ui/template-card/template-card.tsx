import { Badge, Group, Text } from "@mantine/core";
import { Link } from "react-router";
import type { TemplateListItem } from "@/entities/template";
import { ROUTES } from "@/shared/config";
import { formatDate } from "@/shared/lib";
import classes from "./template-card.module.scss";

export function TemplateCard({
  template,
  projectId,
}: {
  template: TemplateListItem;
  projectId: string;
}) {
  return (
    <Link to={ROUTES.template(projectId, template.id)} className={classes.card}>
      <div className={classes.paper} aria-hidden>
        <span className={classes.titleLine} />
        <span className={classes.line} />
        <span className={classes.line} />
        <span className={classes.lineShort} />
        <span className={classes.gap} />
        <span className={classes.line} />
        <span className={classes.lineShort} />
        {template.currentNumber && (
          <span className={classes.version}>v{template.currentNumber}</span>
        )}
      </div>
      <div className={classes.meta}>
        <Text fw={600} size="sm" lineClamp={1} title={template.name}>
          {template.name}
        </Text>
        <Group gap={6} mt={4} wrap="nowrap">
          {template.currentNumber ? (
            <Badge size="xs" color="teal" variant="light">
              Faol
            </Badge>
          ) : (
            <Badge size="xs" color="gray" variant="light">
              Publish qilinmagan
            </Badge>
          )}
          {template.hasDraft && (
            <Badge size="xs" color="yellow" variant="light">
              Qoralama
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed" mt={6}>
          {formatDate(template.updatedAt)}
        </Text>
      </div>
    </Link>
  );
}
