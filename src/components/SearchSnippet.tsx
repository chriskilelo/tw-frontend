import type { ReactNode } from 'react'

/**
 * ts_headline (App\Services\SearchService) only ever inserts literal `<b>`/
 * `</b>` around the matched term — it does not escape the rest of the
 * source text, which comes from user-submitted alert/inquiry field content.
 * Splitting on those two literal delimiters and rendering each segment as a
 * React text node (auto-escaped) highlights the match without ever parsing
 * the snippet as HTML, so no dangerouslySetInnerHTML / XSS exposure.
 */
export function SearchSnippet({ snippet }: { snippet: string }) {
  const nodes = snippet.split(/(<b>|<\/b>)/).reduce<{ bold: boolean; nodes: ReactNode[] }>(
    (acc, part, index) => {
      if (part === '<b>') {
        return { ...acc, bold: true }
      }
      if (part === '</b>') {
        return { ...acc, bold: false }
      }
      if (part === '') {
        return acc
      }
      acc.nodes.push(acc.bold ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>)
      return acc
    },
    { bold: false, nodes: [] },
  ).nodes

  return <>{nodes}</>
}
