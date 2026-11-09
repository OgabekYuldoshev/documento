import { CreateProjectButton } from "@/features/projects/create-project";
import { PageHeader } from "@/shared/ui";
import { ProjectsTable } from "@/widgets/projects-table";

export function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Project'lar"
        description="Hujjat shablonlari va integratsiyalar project ichida jamlanadi."
        actions={<CreateProjectButton />}
      />
      <ProjectsTable />
    </>
  );
}
