"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  if (emails.length === 0) {
    return null;
  }

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" onClick={onClick} variant="secondary" size="sm">
      {copied ? "Copied" : `Copy ${emails.length} emails`}
    </Button>
  );
}
