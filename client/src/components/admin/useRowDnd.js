import { useRef, useState } from "react";

// Native HTML5 drag-and-drop for table rows, driven by a grab handle.
// Spread `handleProps(index)` onto the handle element and `rowProps(index)`
// onto the row; `overIndex` is the row currently hovered as a drop target.
// Calls `onReorder(fromIndex, toIndex)` when a drop completes.
export default function useRowDnd(onReorder) {
  const from = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleProps = (index) => ({
    draggable: true,
    onDragStart: (e) => {
      from.current = index;
      e.dataTransfer.effectAllowed = "move";
      // Drag a ghost of the whole row, not just the handle.
      const tr = e.currentTarget.closest("tr");
      if (tr) {
        try {
          e.dataTransfer.setDragImage(tr, 16, 16);
        } catch (_) {
          /* setDragImage unsupported — fall back to default ghost */
        }
      }
    },
    onDragEnd: () => {
      from.current = null;
      setOverIndex(null);
    },
  });

  const rowProps = (index) => ({
    onDragOver: (e) => {
      if (from.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (overIndex !== index) setOverIndex(index);
    },
    onDrop: (e) => {
      e.preventDefault();
      const f = from.current;
      from.current = null;
      setOverIndex(null);
      if (f === null || f === index) return;
      onReorder(f, index);
    },
  });

  return { overIndex, handleProps, rowProps };
}

// Move an item within an array, returning a new array.
export const moveItem = (arr, from, to) => {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};
