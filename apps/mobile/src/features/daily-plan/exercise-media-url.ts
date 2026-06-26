export function getExerciseMediaDisplayUrl(url: string) {
  return /\.webp($|\?)/i.test(url) ? url.replace(/\.webp(?=$|\?)/i, '.jpg') : url;
}

export function getExerciseMediaFallbackUrl(currentUrl: string, originalUrl: string) {
  if (currentUrl !== originalUrl) return originalUrl;
  const jpegUrl = getExerciseMediaDisplayUrl(originalUrl);
  return jpegUrl !== originalUrl ? jpegUrl : null;
}
