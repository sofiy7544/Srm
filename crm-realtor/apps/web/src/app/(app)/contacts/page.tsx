import { redirect } from 'next/navigation';

export default async function ContactsAliasPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((vv) => qs.append(k, vv));
    else if (typeof v === 'string') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/clients${query ? `?${query}` : ''}`);
}
