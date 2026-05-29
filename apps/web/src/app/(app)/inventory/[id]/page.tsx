import { redirect } from 'next/navigation';

export default async function InventoryDetailAliasPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/properties/${id}`);
}
