import Image, { type ImageProps } from "next/image";

/**
 * Photos live behind `/api/photos/*`, which checks the session cookie for
 * private catalogs. Next.js image optimization re-fetches that URL on the
 * server *without* cookies, gets JSON 404, and logs:
 *   "The requested resource isn't a valid image ... received null"
 *
 * `unoptimized` makes the browser load the URL directly (with cookies).
 */
export default function GearPhoto({
  alt,
  ...props
}: Omit<ImageProps, "unoptimized">) {
  return <Image alt={alt} {...props} unoptimized />;
}
