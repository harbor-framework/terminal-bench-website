'use client';

import {
  Copy01Icon,
  Download02Icon,
  Link02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toBlob, toSvg } from 'html-to-image';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ExportState = 'idle' | 'copied' | 'error';

type ViewExportActionsProps = {
  targetId: string;
  fileBaseName: string;
  getMarkdown: () => string;
  disabled?: boolean;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * html-to-image deep-clones `<svg>` subtrees without inlining computed styles
 * (its per-element style copy skips SVG descendants), so class-based fills and
 * strokes fall back to SVG defaults in the detached export document. Inline the
 * resolved values on the live nodes for the duration of the export, then
 * restore the original inline styles.
 */
const SVG_EXPORT_STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
] as const;

async function withInlinedSvgStyles<T>(
  root: HTMLElement,
  run: () => Promise<T>,
): Promise<T> {
  const touched: { element: SVGElement; previous: string | null }[] = [];
  for (const element of root.querySelectorAll<SVGElement>('svg, svg *')) {
    const computed = window.getComputedStyle(element);
    touched.push({ element, previous: element.getAttribute('style') });
    for (const property of SVG_EXPORT_STYLE_PROPS) {
      element.style.setProperty(property, computed.getPropertyValue(property));
    }
  }

  try {
    return await run();
  } finally {
    for (const { element, previous } of touched) {
      if (previous === null) element.removeAttribute('style');
      else element.setAttribute('style', previous);
    }
  }
}

function getTargetElement(targetId: string): HTMLElement {
  const element = document.getElementById(targetId);
  if (!element) throw new Error('Could not find export target');
  return element;
}

function exportOptions(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(element.scrollWidth, rect.width));
  const height = Math.ceil(Math.max(element.scrollHeight, rect.height));
  const { backgroundColor } = window.getComputedStyle(element);
  return {
    backgroundColor,
    cacheBust: true,
    height,
    pixelRatio: 2,
    style: {
      height: `${height}px`,
      maxWidth: 'none',
      width: `${width}px`,
    },
    width,
  };
}

async function downloadElementPng(targetId: string, filename: string) {
  const element = getTargetElement(targetId);
  const blob = await withInlinedSvgStyles(element, () =>
    toBlob(element, exportOptions(element)),
  );
  if (!blob) throw new Error('Could not create PNG');
  downloadBlob(blob, filename);
}

async function downloadElementSvg(targetId: string, filename: string) {
  const element = getTargetElement(targetId);
  const dataUrl = await withInlinedSvgStyles(element, () =>
    toSvg(element, exportOptions(element)),
  );
  const blob = await fetch(dataUrl).then((response) => response.blob());
  downloadBlob(blob, filename);
}

function copyCurrentViewLink(): Promise<void> {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.hash = '';
  return navigator.clipboard.writeText(url.toString());
}

export function ViewExportActions({
  targetId,
  fileBaseName,
  getMarkdown,
  disabled = false,
}: ViewExportActionsProps) {
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [linkState, setLinkState] = useState<ExportState>('idle');

  function resetExportState() {
    window.setTimeout(() => setExportState('idle'), 1600);
  }

  function resetLinkState() {
    window.setTimeout(() => setLinkState('idle'), 1600);
  }

  async function handleCopyMarkdown() {
    if (disabled) return;

    try {
      await navigator.clipboard.writeText(getMarkdown());
      setExportState('copied');
    } catch {
      setExportState('error');
    } finally {
      resetExportState();
    }
  }

  async function handleDownloadPng() {
    if (disabled) return;

    try {
      await downloadElementPng(targetId, `${fileBaseName}.png`);
      setExportState('idle');
    } catch (error) {
      console.error('PNG export failed', error);
      setExportState('error');
      resetExportState();
    }
  }

  async function handleDownloadSvg() {
    if (disabled) return;

    try {
      await downloadElementSvg(targetId, `${fileBaseName}.svg`);
      setExportState('idle');
    } catch (error) {
      console.error('SVG export failed', error);
      setExportState('error');
      resetExportState();
    }
  }

  async function handleCopyLink() {
    try {
      await copyCurrentViewLink();
      setLinkState('copied');
    } catch {
      setLinkState('error');
    } finally {
      resetLinkState();
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Export view"
              title="Export view"
              disabled={disabled}
              className="active:!translate-y-0"
            />
          }
        >
          <HugeiconsIcon
            icon={exportState === 'copied' ? Tick02Icon : Copy01Icon}
            strokeWidth={2}
            className={cn(
              'text-muted-foreground',
              exportState === 'error' && 'text-destructive',
            )}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem onClick={handleCopyMarkdown}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
            Copy markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPng}>
            <HugeiconsIcon icon={Download02Icon} strokeWidth={2} />
            Download PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadSvg}>
            <HugeiconsIcon icon={Download02Icon} strokeWidth={2} />
            Download SVG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy filters link"
              onClick={handleCopyLink}
              className="active:!translate-y-0"
            />
          }
        >
          <HugeiconsIcon
            icon={linkState === 'copied' ? Tick02Icon : Link02Icon}
            strokeWidth={2}
            className={cn(
              'text-muted-foreground',
              linkState === 'error' && 'text-destructive',
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          {linkState === 'copied'
            ? 'Copied filters link'
            : linkState === 'error'
              ? 'Could not copy link'
              : 'Copy filters link'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
