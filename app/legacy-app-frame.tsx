"use client";

import { useEffect, useState } from "react";

export default function LegacyAppFrame() {
  const [legacyUrl, setLegacyUrl] = useState("/index.html");

  useEffect(() => {
    const syncLocation = () => {
      setLegacyUrl(`/index.html${window.location.search}${window.location.hash}`);
    };

    syncLocation();
    window.addEventListener("hashchange", syncLocation);
    window.addEventListener("popstate", syncLocation);

    return () => {
      window.removeEventListener("hashchange", syncLocation);
      window.removeEventListener("popstate", syncLocation);
    };
  }, []);

  return (
    <iframe
      className="legacy-app"
      src={legacyUrl}
      title="Hellobase CRM"
    />
  );
}
