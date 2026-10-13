import svg from '../assets/logo.svg?raw';

// Built into the bundle rather than loaded from /icons: behind Netlify visitor access a separate
// image request can be refused once the visitor's session expires, which shows a broken image.
const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;

export default function Logo({ className }: { className?: string }) {
  return <img src={src} alt="" className={className} />;
}
