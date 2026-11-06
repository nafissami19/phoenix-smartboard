import { useEffect } from "react";
import { useRouter } from "@/lib/navigation";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { BrandMark } from "@/components/BrandMark";


function Splash() {
  const { profile } = useApp();
  return (
    <div className="grid h-dvh w-full place-items-center bg-base">
      <div className="flex flex-col items-center gap-5">
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-white shadow-[0_0_40px_-8px_rgba(255,255,255,0.4)]">
          <BrandMark className="h-12 w-12" />
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
        </div>
        <p className="text-xl font-semibold">{profile.appName}</p>
        <p className="text-sm text-muted">{profile.splashText || "A space for every lesson"}</p>
      </div>
    </div>
  );
}

// Shown instead of routing when the saved profile cannot be read, so setup never
// runs with defaults that would then be saved over the teacher's real settings.
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-dvh w-full place-items-center bg-base p-4">
      <div role="alert" className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-line bg-panel p-6 text-center">
        <BrandMark className="h-12 w-12" />
        <p className="text-lg font-semibold">Your saved settings could not be opened</p>
        <p className="text-sm text-muted">{message} Your lessons and settings have not been changed.</p>
        <button type="button" onClick={onRetry} className="kn-focus min-h-11 rounded-xl bg-brand px-6 py-2 font-semibold text-white">Retry</button>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { profile, loading, loadError, retryLoad } = useApp();

  useEffect(() => {
    if (loading || loadError) return;
    router.replace(profile.onboarded ? "/library" : "/onboarding");
  }, [loading, loadError, profile.onboarded, router]);

  if (loadError && !loading) return <LoadError message={loadError} onRetry={() => void retryLoad()} />;
  return <Splash />;
}
