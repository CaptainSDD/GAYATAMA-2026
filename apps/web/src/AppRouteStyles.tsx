import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import './styles.css?app';

const APP_TITLE = 'LOKABIS — Analisis lokasi usaha';
const APP_DESCRIPTION = 'Analisis lokasi usaha mikro dengan bukti fasilitas, skor, dan rentang ketidakpastian.';

function setMetaContent(selector: string, content: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', content);
}

/** Loads the Glass Instrument Deck stylesheet and neutral metadata only for app routes. */
export function AppRouteStyles() {
  useEffect(() => {
    const previousTitle = document.title;
    const previousDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';
    const previousOpenGraphTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? '';
    const previousOpenGraphDescription =
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? '';
    const previousTwitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content ?? '';
    const previousTwitterDescription =
      document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.content ?? '';

    document.title = APP_TITLE;
    setMetaContent('meta[name="description"]', APP_DESCRIPTION);
    setMetaContent('meta[property="og:title"]', APP_TITLE);
    setMetaContent('meta[property="og:description"]', APP_DESCRIPTION);
    setMetaContent('meta[name="twitter:title"]', APP_TITLE);
    setMetaContent('meta[name="twitter:description"]', APP_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      setMetaContent('meta[name="description"]', previousDescription);
      setMetaContent('meta[property="og:title"]', previousOpenGraphTitle);
      setMetaContent('meta[property="og:description"]', previousOpenGraphDescription);
      setMetaContent('meta[name="twitter:title"]', previousTwitterTitle);
      setMetaContent('meta[name="twitter:description"]', previousTwitterDescription);
    };
  }, []);

  return <Outlet />;
}
