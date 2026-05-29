import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { MobileNav } from '@/components/mobile-nav';
import { HotkeysProvider } from '@/components/hotkeys-provider';
import { CommandPalette } from '@/components/command-palette';
import { QuickCreate } from '@/components/quick-create';
import { QuickCaptureDialog } from '@/components/quick-capture-dialog';
import { HotkeysHelpDialog } from '@/components/hotkeys-help-dialog';
import { ConfirmDialogHost } from '@/components/ui/confirm-dialog';

/**
 * SUPERSEDES the Sprint 1 layout. Adds <ConfirmDialogHost /> so the
 * imperative useConfirm() hook works from anywhere.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 p-2 md:py-4 md:pr-4 md:pl-3">
        <div className="surface-card flex-1 flex flex-col min-h-0 overflow-hidden rounded-lg md:rounded-xl">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-3 pb-mobile-nav sm:p-5 sm:pb-mobile-nav md:p-7 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
      <MobileNav />

      {/* Global overlays — mounted once, controlled via stores. */}
      <HotkeysProvider />
      <CommandPalette />
      <QuickCreate />
      <QuickCaptureDialog />
      <HotkeysHelpDialog />
      <ConfirmDialogHost />
    </div>
  );
}
