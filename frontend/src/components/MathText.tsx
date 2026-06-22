'use client';

import React from 'react';
import { InlineMath } from 'react-katex';

interface MathTextProps {
  children: string;
  className?: string;
}

export function MathText({ children, className }: MathTextProps) {
  const segments = children.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.startsWith('$$') && segment.endsWith('$$')) {
          return (
            <span key={index} className="my-2 block overflow-x-auto py-1 text-center">
              <InlineMath
                math={segment.slice(2, -2)}
                renderError={() => <span>{segment}</span>}
              />
            </span>
          );
        }

        if (segment.startsWith('$') && segment.endsWith('$')) {
          return (
            <InlineMath
              key={index}
              math={segment.slice(1, -1)}
              renderError={() => <span>{segment}</span>}
            />
          );
        }

        return <React.Fragment key={index}>{segment}</React.Fragment>;
      })}
    </span>
  );
}
