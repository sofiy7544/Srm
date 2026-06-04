// ffprobe-static ships no types. It exports the absolute path to the bundled
// ffprobe binary for the current platform (and per-platform paths).
declare module 'ffprobe-static' {
  const ffprobe: { path: string };
  export default ffprobe;
}
