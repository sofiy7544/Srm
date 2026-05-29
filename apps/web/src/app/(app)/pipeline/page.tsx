import { redirect } from 'next/navigation';

/**
 * Transitional alias: /pipeline → /leads. Sprint 1.2 physically renames the
 * (app)/leads folder to (app)/pipeline, after which this file is replaced
 * with the actual page. Until then this keeps sidebar links resolving.
 *
 * Implemented as a route alias instead of a next.config redirect because we
 * want to preserve query params (e.g. /pipeline?stage=NEW links from the
 * pipeline-pulse chips on /today).
 */
export default async function PipelineAliasPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((vv) => qs.append(k, vv));
    else if (typeof v === 'string') qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/leads${query ? `?${query}` : ''}`);
}
