'use client';

import { Archive, ArchiveRestore, Copy, Eye, MoreHorizontal, Pencil } from 'lucide-react';
import { Menu, type MenuItem } from '@/components/ui/menu';
import type { Good } from '@/lib/types';

interface RowActionsProps {
  good: Good;
  editable: boolean;
  onView: (g: Good) => void;
  onEdit: (g: Good) => void;
  onDuplicate: (g: Good) => void;
  onArchive: (g: Good) => void;
  onRestore: (g: Good) => void;
}

export function RowActions({ good, editable, onView, onEdit, onDuplicate, onArchive, onRestore }: RowActionsProps) {
  const icon = (I: typeof Eye) => <I className="size-4" aria-hidden />;
  const items: (MenuItem | 'separator')[] = [{ label: 'View details and history', icon: icon(Eye), onSelect: () => onView(good) }];
  if (editable) {
    if (!good.archivedAt) {
      items.push(
        { label: 'Edit', icon: icon(Pencil), onSelect: () => onEdit(good) },
        { label: 'Duplicate', hint: 'Same item and prices, new order', icon: icon(Copy), onSelect: () => onDuplicate(good) },
        'separator',
        { label: 'Archive', icon: icon(Archive), tone: 'danger', onSelect: () => onArchive(good) },
      );
    } else {
      items.push('separator', { label: 'Restore', icon: icon(ArchiveRestore), onSelect: () => onRestore(good) });
    }
  }

  return (
    <Menu
      items={items}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          onClick={(e) => {
            e.stopPropagation();
            props.onClick();
          }}
          className="rounded-md p-1.5 text-ink-3 hover:bg-glacier hover:text-ink"
          aria-label={`Actions for ${good.itemName}`}
        >
          <MoreHorizontal className="size-4" />
        </button>
      )}
    />
  );
}
