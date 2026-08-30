import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const Globe3D = lazy(() => import("./Globe3D"));

export function Globe() {
  return (
    <ClientOnly fallback={<div className="h-[460px] w-full md:h-[560px]" />}>
      <Suspense fallback={<div className="h-[460px] w-full md:h-[560px]" />}>
        <Globe3D />
      </Suspense>
    </ClientOnly>
  );
}
