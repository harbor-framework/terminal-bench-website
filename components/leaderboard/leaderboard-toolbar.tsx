'use client';

import {
  Cancel01Icon,
  FilterIcon,
  LayoutThreeColumnIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { DateRange } from 'react-day-picker';
import type { OnChangeFn, VisibilityState } from '@tanstack/react-table';
import { useMemo } from 'react';

import { HomeViewToggle } from '@/components/home-view-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  formatLeaderboardCell,
  getAccessorValue,
  parseLeaderboardLink,
  type LeaderboardColumn,
  type LeaderboardRow,
} from '@/lib/leaderboard';
import { cn } from '@/lib/utils';

export type NumberFilter = {
  min: number;
  max: number;
};

export type DateFilter = {
  from?: string;
  to?: string;
};

export type SetFilter = string[];

export type LeaderboardFilters = {
  numbers: Record<string, NumberFilter>;
  dates: Record<string, DateFilter>;
  sets: Record<string, SetFilter>;
};

export type ColumnOption = {
  id: string;
  label: string;
  canHide: boolean;
};

type NumberBounds = Record<string, { min: number; max: number }>;
type DateBounds = Record<string, { min: string; max: string }>;
type SetOptions = Record<string, string[]>;

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function filterKeyValue(value: unknown, type: LeaderboardColumn['type']): string | null {
  if (value == null || value === '') return null;
  if (type === 'link') {
    return parseLeaderboardLink(value)?.label ?? String(value);
  }
  return String(value);
}

export function buildFilterFacets(
  columns: LeaderboardColumn[],
  rows: LeaderboardRow[],
): {
  numberBounds: NumberBounds;
  dateBounds: DateBounds;
  setOptions: SetOptions;
} {
  const numberBounds: NumberBounds = {};
  const dateBounds: DateBounds = {};
  const setOptions: SetOptions = {};

  for (const column of columns) {
    if (column.id === 'rank') continue;

    switch (column.type) {
      case 'number': {
        const values = rows
          .map((row) => getAccessorValue(row, column.accessor))
          .filter((value): value is number => typeof value === 'number');
        if (values.length === 0) break;
        numberBounds[column.id] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
        break;
      }
      case 'date': {
        const values = rows
          .map((row) => getAccessorValue(row, column.accessor))
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .sort();
        if (values.length === 0) break;
        dateBounds[column.id] = {
          min: values[0],
          max: values[values.length - 1],
        };
        break;
      }
      case 'text':
      case 'link':
      case 'boolean':
      case 'markdown': {
        const values = new Set<string>();
        for (const row of rows) {
          const key = filterKeyValue(
            getAccessorValue(row, column.accessor),
            column.type,
          );
          if (key != null) values.add(key);
        }
        setOptions[column.id] = [...values].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' }),
        );
        break;
      }
      default: {
        const _exhaustive: never = column.type;
        void _exhaustive;
      }
    }
  }

  return { numberBounds, dateBounds, setOptions };
}

export function createEmptyFilters(
  numberBounds: NumberBounds,
): LeaderboardFilters {
  const numbers: Record<string, NumberFilter> = {};
  for (const [id, bounds] of Object.entries(numberBounds)) {
    numbers[id] = { min: bounds.min, max: bounds.max };
  }
  return { numbers, dates: {}, sets: {} };
}

export function countActiveFilters(
  filters: LeaderboardFilters,
  numberBounds: NumberBounds,
): number {
  let count = 0;
  for (const [id, range] of Object.entries(filters.numbers)) {
    const bounds = numberBounds[id];
    if (!bounds) continue;
    if (range.min > bounds.min || range.max < bounds.max) count += 1;
  }
  for (const range of Object.values(filters.dates)) {
    if (range.from || range.to) count += 1;
  }
  for (const values of Object.values(filters.sets)) {
    if (values.length > 0) count += 1;
  }
  return count;
}

export function applyLeaderboardFilters(
  rows: LeaderboardRow[],
  columns: LeaderboardColumn[],
  filters: LeaderboardFilters,
  numberBounds: NumberBounds,
): LeaderboardRow[] {
  const columnById = new Map(columns.map((column) => [column.id, column]));

  return rows.filter((row) => {
    for (const [id, range] of Object.entries(filters.numbers)) {
      const bounds = numberBounds[id];
      const column = columnById.get(id);
      if (!bounds || !column) continue;
      if (range.min <= bounds.min && range.max >= bounds.max) continue;
      const value = getAccessorValue(row, column.accessor);
      if (typeof value !== 'number') return false;
      if (value < range.min || value > range.max) return false;
    }

    for (const [id, range] of Object.entries(filters.dates)) {
      const column = columnById.get(id);
      if (!column || (!range.from && !range.to)) continue;
      const value = getAccessorValue(row, column.accessor);
      if (typeof value !== 'string') return false;
      if (range.from && value < range.from) return false;
      if (range.to && value > range.to) return false;
    }

    for (const [id, selected] of Object.entries(filters.sets)) {
      const column = columnById.get(id);
      if (!column || selected.length === 0) continue;
      const key = filterKeyValue(
        getAccessorValue(row, column.accessor),
        column.type,
      );
      if (key == null || !selected.includes(key)) return false;
    }

    return true;
  });
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function sliderStep(bounds: { min: number; max: number }): number {
  const span = bounds.max - bounds.min;
  if (span <= 1) return 0.01;
  if (span <= 100) return 0.1;
  if (span <= 10_000) return 1;
  if (span <= 1_000_000) return 1000;
  return Math.max(1, Math.round(span / 200));
}

type LeaderboardToolbarProps = {
  columns: LeaderboardColumn[];
  columnOptions: ColumnOption[];
  filters: LeaderboardFilters;
  onFiltersChange: (filters: LeaderboardFilters) => void;
  numberBounds: NumberBounds;
  dateBounds: DateBounds;
  setOptions: SetOptions;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: OnChangeFn<VisibilityState>;
};

export function LeaderboardToolbar({
  columns,
  columnOptions,
  filters,
  onFiltersChange,
  numberBounds,
  dateBounds,
  setOptions,
  columnVisibility,
  onColumnVisibilityChange,
}: LeaderboardToolbarProps) {
  const activeFilterCount = countActiveFilters(filters, numberBounds);

  const filterColumns = useMemo(
    () => columns.filter((column) => column.id !== 'rank'),
    [columns],
  );

  function resetFilters() {
    onFiltersChange(createEmptyFilters(numberBounds));
  }

  function toggleSetValue(columnId: string, value: string, checked: boolean) {
    const current = new Set(filters.sets[columnId] ?? []);
    if (checked) current.add(value);
    else current.delete(value);
    onFiltersChange({
      ...filters,
      sets: {
        ...filters.sets,
        [columnId]: [...current],
      },
    });
  }

  function setNumberFilter(columnId: string, value: number[]) {
    const [min, max] = value;
    onFiltersChange({
      ...filters,
      numbers: {
        ...filters.numbers,
        [columnId]: { min, max },
      },
    });
  }

  function setDateFilter(columnId: string, range: DateRange | undefined) {
    onFiltersChange({
      ...filters,
      dates: {
        ...filters.dates,
        [columnId]: {
          from: range?.from ? toIsoDate(range.from) : undefined,
          to: range?.to ? toIsoDate(range.to) : undefined,
        },
      },
    });
  }

  const visibleColumnIds = columnOptions
    .filter((column) => columnVisibility[column.id] !== false)
    .map((column) => column.id);

  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  type ActiveChip = {
    key: string;
    header: string;
    label: string;
    onRemove: () => void;
  };

  const activeChips = useMemo(() => {
    const chips: ActiveChip[] = [];

    for (const [id, range] of Object.entries(filters.numbers)) {
      const bounds = numberBounds[id];
      const column = columnById.get(id);
      if (!bounds || !column) continue;
      if (range.min <= bounds.min && range.max >= bounds.max) continue;
      chips.push({
        key: `number:${id}`,
        header: column.header,
        label: `${formatNumber(range.min)} – ${formatNumber(range.max)}`,
        onRemove: () =>
          setNumberFilter(id, [bounds.min, bounds.max]),
      });
    }

    for (const [id, range] of Object.entries(filters.dates)) {
      const column = columnById.get(id);
      if (!column || (!range.from && !range.to)) continue;
      chips.push({
        key: `date:${id}`,
        header: column.header,
        label: `${range.from ?? '…'} → ${range.to ?? '…'}`,
        onRemove: () => setDateFilter(id, undefined),
      });
    }

    for (const [id, values] of Object.entries(filters.sets)) {
      const column = columnById.get(id);
      if (!column || values.length === 0) continue;
      for (const value of values) {
        chips.push({
          key: `set:${id}:${value}`,
          header: column.header,
          label:
            column.type === 'boolean'
              ? formatLeaderboardCell(value === 'true', 'boolean')
              : value,
          onRemove: () => toggleSetValue(id, value, false),
        });
      }
    }

    return chips;
  }, [columnById, filters, numberBounds]);

  return (
    <div className="flex min-w-0 flex-1 flex-wrap-reverse items-center justify-end gap-1.5">
      {activeFilterCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden h-8 shrink-0 px-2.5 text-xs font-medium text-muted-foreground sm:inline-flex"
          onClick={resetFilters}
        >
          Clear all
        </Button>
      ) : null}
      {activeChips.map((chip) => (
        <Badge
          key={chip.key}
          variant="outline"
          className="hidden h-8 gap-0 rounded-lg bg-card px-2 py-0 font-sans text-xs font-normal sm:inline-flex"
        >
          <span className="self-center font-medium uppercase leading-none text-muted-foreground">
            {chip.header}
          </span>
          <span
            aria-hidden
            className="mx-2 w-px self-stretch shrink-0 bg-border"
          />
          <span className="max-w-[min(16rem,calc(100vw-12rem))] truncate">
            {chip.label}
          </span>
          <button
            type="button"
            aria-label={`Remove ${chip.header} filter`}
            className="-mr-1 inline-flex h-full items-center justify-center px-1.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={chip.onRemove}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
          </button>
        </Badge>
      ))}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Mobile: drawers below sm */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <Drawer showSwipeHandle>
            <DrawerTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={
                    activeFilterCount > 0
                      ? `Filters, ${activeFilterCount} selected`
                      : 'Filters'
                  }
                  className={cn(
                    'relative',
                    activeFilterCount > 0 && 'bg-muted text-foreground',
                  )}
                />
              }
            >
              <HugeiconsIcon
                icon={FilterIcon}
                strokeWidth={2}
                className="text-muted-foreground"
              />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] leading-none tabular-nums text-background"
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] overflow-hidden">
              <DrawerHeader>
                <DrawerTitle>Filters</DrawerTitle>
              </DrawerHeader>
              <div
                data-base-ui-swipe-ignore=""
                className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <div className="flex flex-col gap-6 px-4 pt-4 pb-8">
                  {filterColumns.map((column) => {
                    if (column.type === 'number' && numberBounds[column.id]) {
                      const bounds = numberBounds[column.id];
                      const range = filters.numbers[column.id] ?? bounds;
                      const isFlat = bounds.min === bounds.max;
                      return (
                        <div key={column.id} className="flex flex-col gap-3">
                          <p className="text-sm font-medium uppercase">
                            {column.header}
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatNumber(range.min)} – {formatNumber(range.max)}
                          </p>
                          <Slider
                            min={bounds.min}
                            max={isFlat ? bounds.max + 1 : bounds.max}
                            step={sliderStep(bounds)}
                            value={[range.min, range.max]}
                            disabled={isFlat}
                            onValueChange={(value) => {
                              if (Array.isArray(value)) {
                                setNumberFilter(column.id, [...value]);
                              }
                            }}
                          />
                        </div>
                      );
                    }

                    // Date-range calendars are desktop-only; skip on mobile.
                    if (column.type === 'date') return null;

                    const options = setOptions[column.id];
                    if (!options?.length) return null;
                    const selected = filters.sets[column.id] ?? [];
                    const selectedSet = new Set(selected);

                    return (
                      <div key={column.id} className="flex flex-col gap-3">
                        <p className="text-sm font-medium uppercase">
                          {column.header}
                        </p>
                        <div className="flex flex-col gap-2">
                          {options.map((option) => (
                            <label
                              key={option}
                              className="flex items-center gap-3 text-sm"
                            >
                              <Checkbox
                                checked={selectedSet.has(option)}
                                onCheckedChange={(checked) =>
                                  toggleSetValue(
                                    column.id,
                                    option,
                                    checked === true,
                                  )
                                }
                              />
                              <span className="truncate">
                                {column.type === 'boolean'
                                  ? formatLeaderboardCell(
                                      option === 'true',
                                      'boolean',
                                    )
                                  : option}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {activeFilterCount > 0 ? (
                <DrawerFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={resetFilters}
                  >
                    Clear all
                  </Button>
                </DrawerFooter>
              ) : null}
            </DrawerContent>
          </Drawer>

          {columnOptions.length > 0 ? (
          <Drawer showSwipeHandle>
            <DrawerTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Columns"
                  className={cn(
                    visibleColumnIds.length < columnOptions.length &&
                      'bg-muted',
                  )}
                />
              }
            >
              <HugeiconsIcon
                icon={LayoutThreeColumnIcon}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] overflow-hidden">
              <DrawerHeader>
                <DrawerTitle>Columns</DrawerTitle>
              </DrawerHeader>
              <div
                data-base-ui-swipe-ignore=""
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <div className="flex flex-col gap-2 px-4 py-4">
                  {columnOptions.map((column) => {
                    const selected = columnVisibility[column.id] !== false;
                    return (
                      <label
                        key={column.id}
                        className={cn(
                          'flex items-center gap-3 text-sm',
                          !column.canHide && selected && 'opacity-60',
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          disabled={!column.canHide && selected}
                          onCheckedChange={(checked) => {
                            onColumnVisibilityChange({
                              ...columnVisibility,
                              [column.id]: checked === true,
                            });
                          }}
                        />
                        <span className="truncate uppercase">{column.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
          ) : null}
        </div>

        {/* Desktop: dropdowns from sm up */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={
                    activeFilterCount > 0
                      ? `Filters, ${activeFilterCount} selected`
                      : 'Filters'
                  }
                  className={cn(
                    'relative',
                    activeFilterCount > 0 && 'bg-muted text-foreground',
                  )}
                />
              }
            >
              <HugeiconsIcon
                icon={FilterIcon}
                strokeWidth={2}
                className="text-muted-foreground"
              />
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] leading-none tabular-nums text-background"
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {filterColumns.map((column) => {
                if (column.type === 'number' && numberBounds[column.id]) {
                  const bounds = numberBounds[column.id];
                  const range = filters.numbers[column.id] ?? bounds;
                  const isFlat = bounds.min === bounds.max;
                  const isActive =
                    range.min > bounds.min || range.max < bounds.max;
                  return (
                    <DropdownMenuSub key={column.id}>
                      <DropdownMenuSubTrigger>
                        <span className="min-w-0 flex-1 truncate">
                          {column.header}
                        </span>
                        {isActive ? (
                          <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                            1
                          </span>
                        ) : null}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64 p-3">
                        <div
                          className="flex flex-col gap-3"
                          onPointerDown={(event) => event.preventDefault()}
                        >
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatNumber(range.min)} –{' '}
                            {formatNumber(range.max)}
                          </p>
                          <Slider
                            min={bounds.min}
                            max={isFlat ? bounds.max + 1 : bounds.max}
                            step={sliderStep(bounds)}
                            value={[range.min, range.max]}
                            disabled={isFlat}
                            onValueChange={(value) => {
                              if (Array.isArray(value)) {
                                setNumberFilter(column.id, [...value]);
                              }
                            }}
                          />
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                }

                if (column.type === 'date' && dateBounds[column.id]) {
                  const selected = filters.dates[column.id];
                  const dateRange: DateRange | undefined = selected?.from
                    ? {
                        from: parseIsoDate(selected.from),
                        to: selected.to
                          ? parseIsoDate(selected.to)
                          : undefined,
                      }
                    : undefined;
                  const isActive = Boolean(selected?.from || selected?.to);
                  return (
                    <DropdownMenuSub key={column.id}>
                      <DropdownMenuSubTrigger>
                        <span className="min-w-0 flex-1 truncate">
                          {column.header}
                        </span>
                        {isActive ? (
                          <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                            1
                          </span>
                        ) : null}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="p-2">
                        <div onPointerDown={(event) => event.preventDefault()}>
                          <Calendar
                            mode="range"
                            numberOfMonths={2}
                            selected={dateRange}
                            onSelect={(range) =>
                              setDateFilter(column.id, range)
                            }
                            defaultMonth={
                              dateRange?.from ??
                              parseIsoDate(dateBounds[column.id].min)
                            }
                            disabled={{
                              before: parseIsoDate(dateBounds[column.id].min),
                              after: parseIsoDate(dateBounds[column.id].max),
                            }}
                          />
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                }

                const options = setOptions[column.id];
                if (!options?.length) return null;
                const selected = filters.sets[column.id] ?? [];
                const selectedSet = new Set(selected);

                return (
                  <DropdownMenuSub key={column.id}>
                    <DropdownMenuSubTrigger>
                      <span className="min-w-0 flex-1 truncate">
                        {column.header}
                      </span>
                      {selected.length > 0 ? (
                        <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                          {selected.length}
                        </span>
                      ) : null}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-44 p-0">
                      <ScrollArea className="h-full max-h-64 [&_[data-slot=scroll-area-viewport]]:max-h-64">
                        {options.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={option}
                            checked={selectedSet.has(option)}
                            onCheckedChange={(checked) =>
                              toggleSetValue(column.id, option, checked)
                            }
                          >
                            <span className="truncate">
                              {column.type === 'boolean'
                                ? formatLeaderboardCell(
                                    option === 'true',
                                    'boolean',
                                  )
                                : option}
                            </span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </ScrollArea>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })}
              {activeFilterCount > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={resetFilters}>
                    Clear all
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {columnOptions.length > 0 ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Columns"
                  className={cn(
                    visibleColumnIds.length < columnOptions.length &&
                      'bg-muted',
                  )}
                />
              }
            >
              <HugeiconsIcon
                icon={LayoutThreeColumnIcon}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 gap-0 p-0">
              <Command>
                <ScrollArea className="[&_[data-slot=scroll-area-viewport]]:max-h-80">
                  <CommandList className="max-h-none overflow-visible">
                    <CommandGroup>
                      {columnOptions.map((column) => {
                        const selected =
                          columnVisibility[column.id] !== false;
                        return (
                          <CommandItem
                            key={column.id}
                            value={`${column.id} ${column.label}`}
                            data-checked={selected || undefined}
                            disabled={!column.canHide && selected}
                            onSelect={() => {
                              onColumnVisibilityChange({
                                ...columnVisibility,
                                [column.id]: !selected,
                              });
                            }}
                          >
                            <span className="truncate">{column.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </ScrollArea>
              </Command>
            </PopoverContent>
          </Popover>
          ) : null}
        </div>

        <HomeViewToggle />
      </div>
    </div>
  );
}
