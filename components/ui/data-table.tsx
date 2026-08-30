'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  type Table as TanStackTable,
} from '@tanstack/react-table';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  footer?: ReactNode;
  toolbar?: ReactNode;
  tableContainerId?: string;
  getRowId?: (originalRow: TData, index: number) => string;
  enableRowSelection?: boolean;
  getRowHref?: (row: TData) => string | undefined;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
};

type DragSelectState = {
  select: boolean;
  originIndex: number;
  pointerId: number;
  baseline: RowSelectionState;
  didMove: boolean;
};

function selectionFromRange<TData>(
  table: TanStackTable<TData>,
  drag: DragSelectState,
  currentIndex: number,
): RowSelectionState {
  const rows = table.getRowModel().rows;
  const next: RowSelectionState = { ...drag.baseline };
  const start = Math.min(drag.originIndex, currentIndex);
  const end = Math.max(drag.originIndex, currentIndex);

  for (let index = start; index <= end; index += 1) {
    const row = rows[index];
    if (!row) continue;
    if (drag.select) next[row.id] = true;
    else delete next[row.id];
  }

  return next;
}

function createSelectColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        aria-label="Select row"
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: {
      headerClassName: 'w-10',
      cellClassName: 'w-10',
    },
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = 'No results.',
  footer,
  toolbar,
  tableContainerId,
  getRowId,
  enableRowSelection = false,
  getRowHref,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>(
    {},
  );
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const dragSelectRef = useRef<DragSelectState | null>(null);
  const suppressRowClickRef = useRef(false);
  const tableRef = useRef<TanStackTable<TData> | null>(null);
  const lastHoverIndexRef = useRef<number | null>(null);

  const visibility = columnVisibility ?? internalVisibility;
  const setVisibility = onColumnVisibilityChange ?? setInternalVisibility;

  const selectColumn = useMemo(() => createSelectColumn<TData>(), []);

  const resolvedColumns = useMemo(
    () =>
      enableRowSelection
        ? ([selectColumn, ...columns] as ColumnDef<TData, TValue>[])
        : columns,
    [columns, enableRowSelection, selectColumn],
  );

  const table = useReactTable({
    data,
    columns: resolvedColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    state: {
      rowSelection,
      sorting,
      columnVisibility: visibility,
    },
  });

  tableRef.current = table;

  useEffect(() => {
    return () => {
      dragSelectRef.current = null;
    };
  }, []);

  function updateDragSelection(visualIndex: number) {
    const drag = dragSelectRef.current;
    const currentTable = tableRef.current;
    if (!drag || !currentTable) return;
    if (lastHoverIndexRef.current === visualIndex) return;
    lastHoverIndexRef.current = visualIndex;
    if (visualIndex !== drag.originIndex) {
      drag.didMove = true;
      suppressRowClickRef.current = true;
    }
    setRowSelection(selectionFromRange(currentTable, drag, visualIndex));
  }

  function handleRowPointerDown(
    row: Row<TData>,
    visualIndex: number,
    event: ReactPointerEvent<HTMLTableRowElement>,
  ) {
    if (!enableRowSelection || event.button !== 0) return;

    // Let interactive cells handle their own pointer gestures.
    if (
      (event.target as HTMLElement).closest(
        'a, button, [data-slot="checkbox"], input, label',
      )
    ) {
      return;
    }

    event.preventDefault();
    suppressRowClickRef.current = false;

    const currentTable = tableRef.current;
    if (!currentTable) return;

    const select = !row.getIsSelected();
    const drag: DragSelectState = {
      select,
      originIndex: visualIndex,
      pointerId: event.pointerId,
      baseline: { ...currentTable.getState().rowSelection },
      didMove: false,
    };
    dragSelectRef.current = drag;
    lastHoverIndexRef.current = null;

    const startX = event.clientX;
    const startY = event.clientY;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const activeDrag = dragSelectRef.current;
      if (!activeDrag || moveEvent.pointerId !== activeDrag.pointerId) return;

      const distance = Math.hypot(
        moveEvent.clientX - startX,
        moveEvent.clientY - startY,
      );
      const target = document.elementFromPoint(
        moveEvent.clientX,
        moveEvent.clientY,
      );
      const hoverRow = target?.closest('[data-row-index]');
      const rawIndex = hoverRow?.getAttribute('data-row-index');
      const hoverIndex = rawIndex == null ? null : Number(rawIndex);

      // Start selecting once the pointer moves enough or crosses into another row.
      if (
        !activeDrag.didMove &&
        distance < 4 &&
        (hoverIndex == null || hoverIndex === activeDrag.originIndex)
      ) {
        return;
      }

      if (!activeDrag.didMove) {
        activeDrag.didMove = true;
        suppressRowClickRef.current = true;
        setIsDragSelecting(true);
        // Include the origin row now that this is a real drag.
        updateDragSelection(activeDrag.originIndex);
      }

      if (hoverIndex != null) {
        updateDragSelection(hoverIndex);
      }
    };

    const endDrag = (upEvent: PointerEvent) => {
      const activeDrag = dragSelectRef.current;
      if (activeDrag && upEvent.pointerId !== activeDrag.pointerId) return;

      const shouldOpen =
        !!getRowHref && activeDrag != null && !activeDrag.didMove;

      dragSelectRef.current = null;
      lastHoverIndexRef.current = null;
      setIsDragSelecting(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);

      if (shouldOpen) {
        const href = getRowHref?.(row.original);
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }

      window.setTimeout(() => {
        suppressRowClickRef.current = false;
      }, 0);
    };

    // Window listeners (no pointer capture) so :hover follows the real cursor.
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  function handleRowClick(row: Row<TData>, event: MouseEvent) {
    if (
      (event.target as HTMLElement).closest(
        'a, button, [data-slot="checkbox"], input, label',
      )
    ) {
      return;
    }

    // With row drag-select enabled, navigation is handled on pointerup.
    if (enableRowSelection) {
      event.preventDefault();
      return;
    }

    if (!getRowHref) return;
    const href = getRowHref(row.original);
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {toolbar ? (
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          {toolbar}
        </div>
      ) : null}
      <div
        id={tableContainerId}
        className="-mx-4 min-w-0 overflow-hidden rounded-none border border-x-0 bg-card md:mx-0 md:rounded-xl md:border-x"
      >
      <ScrollArea className="w-full [&_[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:hidden">
        <Table className="min-w-max w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.headerClassName}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            data-drag-selecting={isDragSelecting ? '' : undefined}
            className={cn(
              enableRowSelection && 'select-none',
              isDragSelecting && '[&_tr]:hover:bg-transparent',
            )}
          >
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row, visualIndex) => {
                const href = getRowHref?.(row.original);
                return (
                  <TableRow
                    key={row.id}
                    data-row-id={row.id}
                    data-row-index={visualIndex}
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(href && 'cursor-pointer')}
                    onClick={(event) => handleRowClick(row, event)}
                    onPointerDown={(event) =>
                      handleRowPointerDown(row, visualIndex, event)
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.columnDef.meta?.cellClassName}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      {footer}
      </div>
    </div>
  );
}
