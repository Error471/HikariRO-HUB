import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

interface WikiLinkProps {
  className?: string;
  children?: ReactNode;
}

const toSegment = (title: string) => title.replace(/ /g, '_');

export function ArticleLink({ title, className, children }: WikiLinkProps & { title: string }) {
  return (
    <Link to="/wiki/$" params={{ _splat: toSegment(title) }} className={className}>
      {children ?? title}
    </Link>
  );
}

export function CategoryLink({ name, className, children }: WikiLinkProps & { name: string }) {
  return (
    <Link to="/wiki/categoria/$name" params={{ name: toSegment(name) }} className={className}>
      {children ?? name}
    </Link>
  );
}
