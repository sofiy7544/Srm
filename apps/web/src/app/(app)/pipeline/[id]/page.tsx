import { redirect } from 'next/navigation';

export default async function PipelineDetailAliasPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/leads/${id}`);
}
