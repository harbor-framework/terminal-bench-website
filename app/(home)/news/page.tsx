import { blog } from '@/lib/source';
import { cn } from '@/lib/utils';
import { GeistSans } from 'geist/font/sans';
import { NewsCard } from './components/news-card';

export default async function BlogPage() {
  const posts = blog.getPages();

  return (
    <article
      className={cn(
        'content-page mx-auto w-full max-w-3xl flex-1 px-4 py-12',
        GeistSans.className,
      )}
    >
      <h1>Blog</h1>
      <p className="page-subtitle mb-10 mt-2 text-muted-foreground">
        Updates and announcements from the Terminal-Bench team.
      </p>

      <div className="-mx-4 mb-6 grid gap-px overflow-hidden border bg-border sm:mx-0">
        {posts
          .sort(
            (a, b) =>
              new Date(b.data.date).getTime() -
              new Date(a.data.date).getTime(),
          )
          .map((post) => (
            <NewsCard
              key={post.url}
              url={post.url}
              date={post.data.date}
              title={post.data.title}
              description={post.data.description}
            />
          ))}
      </div>
    </article>
  );
}
