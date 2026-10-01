import { VirtualComputerPanel } from "@virtual-computer/ui/VirtualComputerPanel";

/** Default theme shell around the in-repo virtual-computer panel (`/api/desk/status`). */
export function VirtualComputerEmbed({ deskLive }: { deskLive?: boolean }) {
  return <VirtualComputerPanel deskLive={deskLive} />;
}
