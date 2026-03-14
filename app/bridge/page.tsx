import { BridgeClient } from "@/components/bridge/bridge-client"

export default function BridgePage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5 lg:p-6">
      <BridgeClient />
    </div>
  )
}
