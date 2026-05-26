
const VIDEO_EXTS = /\.(mp4|webm|mov)$/i
const CLOUDINARY_UPLOAD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\/)(.*)$/i

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXTS.test(url)
}

interface Options {
  width: number
}

// Resolves a media entry to a renderable URL.
// - Cloudinary URLs get our transforms injected after /upload/ (chained as the
//   first transform stage, so any existing transforms still apply downstream).
// - Other http(s) URLs are returned untouched (lets us keep picsum placeholders
//   and any externally-hosted assets).
// - Anything else is treated as a Cloudinary public ID and wrapped with our
//   transforms against the configured cloud.
export function resolveMediaUrl(idOrUrl: string, opts: Options): string {
  const transforms = `f_auto,q_auto,c_limit,w_${opts.width}`

  const cloudinaryMatch = idOrUrl.match(CLOUDINARY_UPLOAD_RE)
  if (cloudinaryMatch) {
    const [, uploadPrefix, rest] = cloudinaryMatch
    return `${uploadPrefix}${transforms}/${rest}`
  }

  if (/^https?:\/\//i.test(idOrUrl)) return idOrUrl

  const kind = VIDEO_EXTS.test(idOrUrl) ? 'video' : 'image'
  return `https://res.cloudinary.com/dmbrivcqo/${kind}/upload/${transforms}/${idOrUrl}`
}
