"use client";

import { useEffect } from "react";
import { Failure } from "@/components/Failure";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <Failure kind="crash" onRetry={retry} closeHref="/" />;
}
