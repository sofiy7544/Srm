import { redirect } from 'next/navigation';

export default async function ContactDetailAliasPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/clients/${id}`);
}
