import { ProjectClient } from "@/components/ProjectClient";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectClient projectId={id} />;
}
