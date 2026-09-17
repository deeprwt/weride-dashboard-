/**
 * Chrome for the whole /rides section.
 *
 * The shell lives in the layout rather than in each page so that it survives
 * navigation between the board and one ride: a layout is not re-rendered when a
 * child segment changes, which means the sidebar and header stay put while only
 * the content swaps — and `loading.tsx` renders inside it instead of blanking
 * the whole console for a moment.
 *
 * It matters more here than on the KYC queue: the board refreshes itself every
 * few seconds, and a shell that repainted on every tick would make the console
 * unusable to read.
 */
import { AdminShell } from '@/components/admin-shell';

export default function RidesLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell title="Rides">{children}</AdminShell>;
}
