import Link from 'next/link';
import { formatNewsDate } from './format-news-date';

interface NewsCardProps {
  url: string;
  date: string | Date;
  title: string;
  description?: string;
}

export function NewsCard({
  url,
  date,
  title,
  description,
}: NewsCardProps) {
  const content = (
    <>
      <h2 className="min-w-0 break-words font-mono text-base font-medium tracking-tight uppercase sm:text-lg">
        {title}
      </h2>
      <time
        dateTime={new Date(date).toISOString()}
        className="justify-self-end whitespace-nowrap pt-1 font-mono text-xs text-muted-foreground"
      >
        {formatNewsDate(date)}
      </time>
      {description && (
        <p className="page-subtitle page-subtitle-sm col-span-2 min-w-0 max-w-3xl break-words text-muted-foreground sm:col-span-1">
          {description}
        </p>
      )}
    </>
  );
  const className =
    'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-3 py-4 no-underline sm:gap-x-6 sm:px-4';

  return (
    <article className="bg-card transition-colors hover:bg-muted/50">
      <Link href={url} className={className}>
        {content}
      </Link>
    </article>
  );
}
