import { useEffect, useRef } from 'react';

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

/**
 * emoji-mart's picker is a web component. Both it and its data are loaded only when
 * the picker opens, so the popup itself stays light.
 */
export const EmojiPicker = ({ onSelect, onClose }: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let cancelled = false;
    let picker: HTMLElement | undefined;
    void Promise.all([
      import('emoji-mart'),
      import('@emoji-mart/data'),
      import('@emoji-mart/data/i18n/ja.json'),
    ]).then(([{ Picker }, { default: data }, { default: i18n }]) => {
      if (cancelled || !hostRef.current) return;
      picker = new Picker({
        data,
        theme: 'auto',
        locale: 'ja',
        // Passing the strings keeps emoji-mart from fetching them from a CDN.
        i18n,
        autoFocus: true,
        previewPosition: 'none',
        skinTonePosition: 'search',
        maxFrequentRows: 2,
        perLine: 9,
        onEmojiSelect: (emoji: { native: string }) => onSelectRef.current(emoji.native),
      }) as unknown as HTMLElement;
      hostRef.current.append(picker);
    });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      picker?.remove();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="emoji-host" ref={hostRef} onClick={(e) => e.stopPropagation()} />
    </div>
  );
};
