"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";

// The product name comes from the operator's betreiber.json. The root layout reads it
// on the server and provides it here, so browser components can show it too.
const Produktname = createContext("");

export function MarkeProvider({ name, children }: { name: string; children: ReactNode }) {
  return <Produktname.Provider value={name}>{children}</Produktname.Provider>;
}

export const useProduktname = () => useContext(Produktname);

/** Logo for dark backgrounds. Operators replace the files in public/marke/. */
export function Logo() {
  const name = useProduktname();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/marke/logo-hell.svg" alt={name} style={{ height: "56px", width: "auto" }} />
  );
}

export function LogoLink() {
  return (
    <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
      <Logo />
    </Link>
  );
}
