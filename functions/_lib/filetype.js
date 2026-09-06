// Detects real file type from its actual bytes, ignoring client-supplied
// filename/MIME (both are trivially spoofable). Only types we actually need
// to accept are recognized; everything else is rejected outright.
export function detectFileType(bytes) {
  const b = bytes;
  const str = (start, len) => String.fromCharCode(...b.slice(start, start + len));

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (str(0, 4) === "GIF8") {
    return { ext: "gif", mime: "image/gif" };
  }
  if (str(0, 4) === "RIFF" && str(8, 4) === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  if (str(0, 4) === "RIFF" && str(8, 4) === "WAVE") {
    return { ext: "wav", mime: "audio/wav" };
  }
  if (str(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) {
    return { ext: "mp3", mime: "audio/mpeg" };
  }
  if (str(0, 4) === "OggS") {
    return { ext: "ogg", mime: "audio/ogg" };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return { ext: "webm", mime: "video/webm" };
  }
  // ISO base media container: covers mp4, mov, and m4a (box type "ftyp" at offset 4)
  if (str(4, 4) === "ftyp") {
    const brand = str(8, 4).toLowerCase();
    if (brand.startsWith("m4a")) return { ext: "m4a", mime: "audio/mp4" };
    if (brand.startsWith("qt")) return { ext: "mov", mime: "video/quicktime" };
    return { ext: "mp4", mime: "video/mp4" };
  }

  return null;
}
