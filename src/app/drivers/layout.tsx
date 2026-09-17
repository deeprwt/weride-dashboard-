/**
 * Chrome for the whole /drivers section.
 *
 * The shell lives in the layout rather than in each page so that it survives
 * navigation between the queue and a review screen: a layout is not re-rendered
 * when a child segment changes, which means the sidebar and header stay put
 * while only the content swaps — and `loading.tsx` renders inside it instead of
 * blanking the whole console for a moment.
 */
import { AdminShell } from '@/components/admin-shell';

export default function DriversLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell title="Drivers">{children}</AdminShell>;
}
