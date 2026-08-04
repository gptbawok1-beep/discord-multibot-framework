export function parseCookiesAuto(content) {
  const lines = content.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 4) {
        count++;
      }
    }
  }
  return { valid: count > 0, count };
}

export function formatLabel(st) {
  if (!st || !st.active) return "🔴 Belum diunggah";
  if (st.status === "ACTIVE" || st.status === "ok") return "🟢 Aktif";
  if (st.status === "EXPIRED") return "🔴 Kedaluwarsa";
  return "🟡 Menunggu verifikasi";
}
