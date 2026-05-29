import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const authed = (await cookies()).get('crm_auth')?.value;
  redirect(authed ? '/today' : '/login');
}
