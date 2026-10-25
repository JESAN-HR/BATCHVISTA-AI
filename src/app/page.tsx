import Workspace from "@/components/workspace";
import BrowserWorkspace from "@/components/browser-workspace";
export const dynamic = "force-dynamic";
export default function Page() {
  return process.env.VERCEL === "1" ||
    process.env.BATCHVISTA_MODE === "browser" ? (
    <BrowserWorkspace />
  ) : (
    <Workspace />
  );
}
