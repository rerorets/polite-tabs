import { useEffect, useRef, useState } from 'react';
import { COLOR_NAMES, COLORS, type GroupColor } from '../shared/colors';
import { COLOR_LABELS } from './colorLabels';

interface Props {
  value: GroupColor;
  onChange: (color: GroupColor) => void;
}

export const ColorPicker = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="color-picker" ref={rootRef}>
      <button
        type="button"
        className="swatch swatch--button"
        style={{ background: COLORS[value] }}
        aria-label={`グループの色：${COLOR_LABELS[value]}`}
        aria-expanded={open}
        title={COLOR_LABELS[value]}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="color-menu" role="listbox" aria-label="グループの色">
          {COLOR_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === value}
              className={`swatch ${name === value ? 'swatch--selected' : ''}`}
              style={{ background: COLORS[name] }}
              title={COLOR_LABELS[name]}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
