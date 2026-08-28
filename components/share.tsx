'use client';

import { Button } from '@/components/ui/button';
import { Check, Link } from 'lucide-react';
import { useState } from 'react';

export function Share() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Button
      variant="ghost"
      className="rounded-none font-mono font-normal"
      onClick={handleCopy}
    >
      {copied ? <Check className="size-4" /> : <Link className="size-4" />}
      <span>{copied ? 'Copied' : 'Share'}</span>
    </Button>
  );
}
