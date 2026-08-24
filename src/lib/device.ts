export function getDeviceFingerprint() {
  if (typeof window === "undefined") return "";
  const key = "manguifi_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
