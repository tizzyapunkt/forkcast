import type { MouseEvent } from 'react';
import { Star } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { de } from '../../i18n/de';

interface FavoriteStarProps {
  /** The ingredient's name — it goes into the accessible label, not the visible row. */
  name: string;
  favorited: boolean;
  onToggle: () => void;
}

/**
 * The favorite toggle that sits beside an ingredient row. It is a sibling of the
 * row's own button rather than a child: a button cannot nest inside a button, and
 * a nested star would be unreliable to tap. The click is stopped here so starring
 * never opens the confirm step behind it.
 */
export function FavoriteStar({ name, favorited, onToggle }: FavoriteStarProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onToggle();
  }

  return (
    <Button
      type="button"
      variant="quiet"
      size="iconSm"
      aria-pressed={favorited}
      aria-label={favorited ? de.favoriteStar.remove(name) : de.favoriteStar.add(name)}
      onClick={handleClick}
      className={favorited ? 'text-primary' : 'text-muted-foreground'}
    >
      <Star aria-hidden="true" className="h-4 w-4" fill={favorited ? 'currentColor' : 'none'} />
    </Button>
  );
}
