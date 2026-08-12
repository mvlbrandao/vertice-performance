"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button variant="solid" onClick={() => window.print()}>
      🖨️ Imprimir / Salvar PDF
    </Button>
  );
}
