import { ProjectClient } from '@/components/ProjectClient';

export default async function ProjectPage({ params }) {
  const { id } = await params;
  return <ProjectClient projectId={id} />;
}
